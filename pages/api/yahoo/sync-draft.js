import { getValidToken } from '@/utils/yahooAuth'
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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = await getValidToken(req, res)
  if (!token) return res.status(401).json({ error: 'Not connected to Yahoo' })

  const { leagueKey } = req.query
  if (!leagueKey) return res.status(400).json({ error: 'leagueKey required' })

  // Build name → PocketBeane id map from local player pool
  const playersPath = path.join(process.cwd(), 'src/data/players.json')
  const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'))
  const nameToId = {}
  for (const p of players) {
    nameToId[normalizeName(p.name)] = p.id
  }

  // Fetch draft results and user's teams in parallel
  const [draftRaw, userTeamsRaw] = await Promise.all([
    yahooFetch(token, `/league/${leagueKey}/draftresults`),
    yahooFetch(token, '/users;use_login=1/games;game_codes=nba/teams'),
  ])

  // Find the user's team key within this league.
  // Yahoo team metadata has team_key (e.g. "428.l.22207.t.3") but no standalone
  // league_key field — derive the league key by stripping the team suffix.
  let userTeamKey = null
  const userGames = userTeamsRaw?.fantasy_content?.users?.[0]?.user?.[1]?.games
  const userGameCount = userGames?.count ?? 0
  outer: for (let i = 0; i < userGameCount; i++) {
    const gameArr = userGames[i]?.game
    if (!gameArr || gameArr[0]?.code !== 'nba') continue
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

  res.json({ picks, userTeamKey, draftPosition, matched, total: picks.length })
}
