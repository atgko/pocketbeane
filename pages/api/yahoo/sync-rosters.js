import { getValidToken } from '@/utils/yahooAuth'
import fs from 'fs'
import path from 'path'

const BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

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

function extractMeta(arr) {
  if (!Array.isArray(arr)) return {}
  return Object.assign({}, ...arr.map((x) => (typeof x === 'object' && !Array.isArray(x) ? x : {})))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = await getValidToken(req, res)
  if (!token) return res.status(401).json({ error: 'Not connected to Yahoo' })

  const { leagueKey, sport = 'nba' } = req.query
  if (!leagueKey) return res.status(400).json({ error: 'leagueKey required' })

  // Build name → PocketBeane id map from the right sport's player pool
  const playerFile = sport === 'mlb' ? 'mlb_players.json' : 'players.json'
  const playersPath = path.join(process.cwd(), 'src/data', playerFile)
  const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'))
  const nameToId = {}
  for (const p of players) {
    nameToId[normalizeName(p.name)] = p.id
  }

  // Fetch rosters, standings, and user identity in parallel
  const [rostersRaw, standingsRaw, userTeamsRaw] = await Promise.all([
    yahooFetch(token, `/league/${leagueKey}/teams/roster`),
    yahooFetch(token, `/league/${leagueKey}/standings`),
    yahooFetch(token, `/users;use_login=1/games;game_codes=${sport}/teams`),
  ])

  // Identify the user's team within this league
  let userTeamKey = null
  const userGames = userTeamsRaw?.fantasy_content?.users?.[0]?.user?.[1]?.games
  const userGameCount = userGames?.count ?? 0
  outer: for (let i = 0; i < userGameCount; i++) {
    const gameArr = userGames[i]?.game
    if (!gameArr || gameArr[0]?.code !== sport) continue
    const teamsObj = gameArr[1]?.teams
    const teamCount = teamsObj?.count ?? 0
    for (let j = 0; j < teamCount; j++) {
      const meta = extractMeta(teamsObj[j]?.team?.[0])
      if (meta.team_key?.split('.t.')?.[0] === leagueKey) {
        userTeamKey = meta.team_key
        break outer
      }
    }
  }

  // Parse standings into a lookup map
  const standingsTeams = standingsRaw?.fantasy_content?.league?.[1]?.standings?.[0]?.teams
  const standingsCount = standingsTeams?.count ?? 0
  const standingsMap = {}
  for (let i = 0; i < standingsCount; i++) {
    const t = standingsTeams[i]?.team
    const meta = extractMeta(t?.[0])
    const outcomes = t?.[2]?.team_standings?.outcome_totals
    standingsMap[meta.team_key] = {
      rank: t?.[2]?.team_standings?.rank ?? null,
      wins: Number(outcomes?.wins ?? 0),
      losses: Number(outcomes?.losses ?? 0),
      ties: Number(outcomes?.ties ?? 0),
      manager: meta.managers?.[0]?.manager?.nickname ?? null,
    }
  }

  // Parse all team rosters
  const teamsObj = rostersRaw?.fantasy_content?.league?.[1]?.teams
  const teamCount = teamsObj?.count ?? 0
  const teams = []

  for (let i = 0; i < teamCount; i++) {
    const t = teamsObj[i]?.team
    const meta = extractMeta(t?.[0])
    const playersObj = t?.[1]?.roster?.[0]?.players
    const playerCount = playersObj?.count ?? 0
    const roster = []

    for (let j = 0; j < playerCount; j++) {
      const p = playersObj[j]?.player
      const pm = Array.isArray(p?.[0]) ? extractMeta(p[0]) : {}
      const playerName = pm.name?.full ?? null
      const playerId = playerName ? (nameToId[normalizeName(playerName)] ?? null) : null
      roster.push({
        playerKey: pm.player_key ?? null,
        name: playerName,
        playerId,
        positions: pm.display_position ?? null,
        yahooTeam: pm.editorial_team_abbr ?? null,
        status: pm.status ?? 'active',
      })
    }

    const standing = standingsMap[meta.team_key] ?? {}
    teams.push({
      teamKey: meta.team_key,
      teamName: meta.name ?? meta.team_key,
      manager: standing.manager ?? meta.managers?.[0]?.manager?.nickname ?? null,
      rank: standing.rank !== undefined ? Number(standing.rank) : null,
      wins: standing.wins ?? 0,
      losses: standing.losses ?? 0,
      ties: standing.ties ?? 0,
      isUser: meta.team_key === userTeamKey,
      roster,
    })
  }

  teams.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))

  const matched = teams.reduce((sum, t) => sum + t.roster.filter(p => p.playerId).length, 0)
  const total = teams.reduce((sum, t) => sum + t.roster.length, 0)

  res.json({ teams, userTeamKey, matched, total, syncedAt: new Date().toISOString() })
}
