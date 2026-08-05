import { getValidToken } from '@/utils/yahooAuth'
import { getPlayerFile } from '@/config/sports'
import fs from 'fs'
import path from 'path'

const BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'
const PLAYER_BATCH_SIZE = 25

async function yahooFetch(token, endpoint) {
  const res = await fetch(`${BASE}${endpoint}?format=json`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Yahoo API ${res.status}: ${text}`)
  }
  return res.json()
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTeamMeta(teamArr) {
  if (!Array.isArray(teamArr)) return {}
  return Object.assign({}, ...teamArr.map((x) => (typeof x === 'object' && !Array.isArray(x) ? x : {})))
}

// Fetch player names directly by player key — works regardless of roster/free-agent status
async function fetchPlayerNames(token, playerKeys) {
  const playerKeyToName = {}
  const batches = []
  for (let i = 0; i < playerKeys.length; i += PLAYER_BATCH_SIZE) {
    batches.push(playerKeys.slice(i, i + PLAYER_BATCH_SIZE))
  }

  await Promise.all(batches.map(async (batch) => {
    const data = await yahooFetch(token, `/players;player_keys=${batch.join(',')}`)
    const playersObj = data?.fantasy_content?.players
    const count = playersObj?.count ?? 0
    for (let i = 0; i < count; i++) {
      const pArr = playersObj[i]?.player?.[0]
      if (!Array.isArray(pArr)) continue
      const meta = Object.assign({}, ...pArr.map((x) => (typeof x === 'object' && !Array.isArray(x) ? x : {})))
      if (meta.player_key && meta.name?.full) {
        playerKeyToName[meta.player_key] = meta.name.full
      }
    }
  }))

  return playerKeyToName
}

// Core sync logic, extracted so src/platforms/yahoo/adapter.js can call it
// directly instead of duplicating this parsing — the route handler below is
// now a thin req/res wrapper around this same function, same HTTP contract
// as before.
export async function syncDraft(token, { leagueKey, sport = 'nba' }) {
  // Build name → PocketBeane id map from the correct sport's player pool
  const playersPath = path.join(process.cwd(), 'src/data', getPlayerFile(sport))
  const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'))
  const nameToId = {}
  for (const p of players) {
    nameToId[normalizeName(p.name)] = p.id
  }

  const gameCode = sport === 'mlb' ? 'mlb' : sport === 'nfl' ? 'nfl' : 'nba'

  try {
  // Fetch draft results and user's teams in parallel
  const [draftRaw, userTeamsRaw] = await Promise.all([
    yahooFetch(token, `/league/${leagueKey}/draftresults`),
    yahooFetch(token, `/users;use_login=1/games;game_codes=${gameCode}/teams`),
  ])

  // Find the user's team key within this league.
  // Yahoo team metadata has team_key (e.g. "428.l.22207.t.3") but no standalone
  // league_key field — derive the league key by stripping the team suffix.
  let userTeamKey = null
  const userGames = userTeamsRaw?.fantasy_content?.users?.[0]?.user?.[1]?.games
  const userGameCount = userGames?.count ?? 0
  outer: for (let i = 0; i < userGameCount; i++) {
    const gameArr = userGames[i]?.game
    if (!gameArr || gameArr[0]?.code !== gameCode) continue
    const teamsObj = gameArr[1]?.teams
    const teamCount = teamsObj?.count ?? 0
    for (let j = 0; j < teamCount; j++) {
      const meta = extractTeamMeta(teamsObj[j]?.team?.[0])
      const teamLeagueKey = meta.team_key?.split('.t.')?.[0]
      if (teamLeagueKey === leagueKey) {
        userTeamKey = meta.team_key
        break outer
      }
    }
  }

  // Parse draft results to get all player keys
  const draftResults = draftRaw?.fantasy_content?.league?.[1]?.draft_results
  const totalPicks = draftResults?.count ?? 0
  const rawPicks = []
  for (let i = 0; i < totalPicks; i++) {
    const d = draftResults[i]?.draft_result
    if (d) rawPicks.push(d)
  }

  // Fetch player names directly by key — covers dropped/traded/free-agent players
  const allPlayerKeys = [...new Set(rawPicks.map(d => d.player_key).filter(Boolean))]
  const playerKeyToName = await fetchPlayerNames(token, allPlayerKeys)

  // Map draft picks to PocketBeane player IDs
  const picks = []
  let draftPosition = null

  for (const d of rawPicks) {
    const playerName = playerKeyToName[d.player_key] ?? null
    const playerId = playerName ? (nameToId[normalizeName(playerName)] ?? null) : null
    const draftedBy = userTeamKey && d.team_key === userTeamKey ? 'user' : 'opponent'

    if (d.round === 1 && draftedBy === 'user') {
      draftPosition = Number(d.pick)
    }

    picks.push({
      pickNumber: Number(d.pick),
      round: Number(d.round),
      playerId,
      playerName,
      draftedBy,
    })
  }

  const matched = picks.filter((p) => p.playerId !== null).length

  return { picks, userTeamKey, draftPosition, matched, total: picks.length }
  } catch (err) {
    const cause = err.cause?.message ?? err.cause ?? ''
    console.error('[sync-draft] error:', err.message, cause ? `| cause: ${cause}` : '')

    // Same season-over signal as sync-rosters.js: once a league's game/season
    // is fully concluded, Yahoo 403s league-scoped calls like draftresults and
    // the games;teams lookup for good (not the transient Y-05d throttle,
    // which cleared on its own). Return this shape instead of throwing so
    // callers can persist it instead of showing a raw Yahoo error on every
    // click.
    const is403 = /\b403\b/.test(err.message) || /\b403\b/.test(cause)
    if (is403) {
      return { isSeasonOver: true, seasonOverReason: '403' }
    }

    throw err
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = await getValidToken(req, res)
  if (!token) return res.status(401).json({ error: 'Not connected to Yahoo' })

  const { leagueKey, sport = 'nba' } = req.query
  if (!leagueKey) return res.status(400).json({ error: 'leagueKey required' })

  try {
    const result = await syncDraft(token, { leagueKey, sport })
    res.json(result)
  } catch (err) {
    const cause = err.cause?.message ?? err.cause ?? ''
    res.status(502).json({ error: cause ? `${err.message}: ${cause}` : err.message })
  }
}
