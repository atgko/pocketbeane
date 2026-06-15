import { getValidToken } from '@/utils/yahooAuth'

const LEAGUE_KEY = '466.l.22207'
const BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

async function yf(token, path) {
  const res = await fetch(`${BASE}${path}?format=json`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Yahoo ${res.status} @ ${path}: ${text}`)
  }
  return res.json()
}

function parseSettings(data) {
  const raw = data?.fantasy_content?.league
  if (!raw) return null
  const settings = raw[1]?.settings?.[0]
  const statCategories = settings?.stat_categories?.stats
    ?.filter((s) => !s.stat.is_only_display_stat)
    .map((s) => ({
      id: s.stat.stat_id,
      name: s.stat.display_name,
      higherIsBetter: s.stat.sort_order === '1',
    }))
  const rosterPositions = settings?.roster_positions?.map((p) => ({
    position: p.roster_position.position,
    count: Number(p.roster_position.count),
    isStarter: p.roster_position.is_starting_position === 1,
  }))
  return { statCategories, rosterPositions }
}

function parseStandings(data) {
  const teams = data?.fantasy_content?.league?.[1]?.standings?.[0]?.teams
  const count = teams?.count ?? 0
  const result = []
  for (let i = 0; i < count; i++) {
    const t = teams[i]?.team
    const info = t?.[0]
    const meta = Array.isArray(info) ? Object.assign({}, ...info.map((x) => (typeof x === 'object' ? x : {}))) : {}
    const outcomes = t?.[2]?.team_standings?.outcome_totals
    result.push({
      teamKey: meta.team_key,
      teamId: meta.team_id,
      name: meta.name,
      manager: meta.managers?.[0]?.manager?.nickname,
      rank: t?.[2]?.team_standings?.rank,
      wins: outcomes?.wins,
      losses: outcomes?.losses,
      ties: outcomes?.ties,
      pointsFor: t?.[2]?.team_standings?.points_for,
    })
  }
  return result.sort((a, b) => a.rank - b.rank)
}

function parseRosters(data) {
  const teams = data?.fantasy_content?.league?.[1]?.teams
  const count = teams?.count ?? 0
  const result = []
  for (let i = 0; i < count; i++) {
    const t = teams[i]?.team
    const info = t?.[0]
    const meta = Array.isArray(info) ? Object.assign({}, ...info.map((x) => (typeof x === 'object' ? x : {}))) : {}
    const players = t?.[1]?.roster?.[0]?.players
    const playerCount = players?.count ?? 0
    const roster = []
    for (let j = 0; j < playerCount; j++) {
      const p = players[j]?.player
      const pm = Array.isArray(p?.[0]) ? Object.assign({}, ...p[0].map((x) => (typeof x === 'object' ? x : {}))) : {}
      roster.push({
        playerKey: pm.player_key,
        name: pm.name?.full,
        positions: pm.display_position,
        team: pm.editorial_team_abbr,
        status: pm.status ?? 'active',
      })
    }
    result.push({ teamKey: meta.team_key, name: meta.name, roster })
  }
  return result
}

function parseDraft(data) {
  const picks = data?.fantasy_content?.league?.[1]?.draft_results
  if (!picks) return []
  const count = picks.count ?? 0
  const result = []
  for (let i = 0; i < count; i++) {
    const d = picks[i]?.draft_result
    if (!d) continue
    result.push({
      pick: d.pick,
      round: d.round,
      teamKey: d.team_key,
      playerKey: d.player_key,
    })
  }
  return result
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = await getValidToken(req, res)
  if (!token) return res.status(401).json({ error: 'Not connected to Yahoo' })

  const [settingsRaw, standingsRaw, rostersRaw, draftRaw] = await Promise.all([
    yf(token, `/league/${LEAGUE_KEY}/settings`),
    yf(token, `/league/${LEAGUE_KEY}/standings`),
    yf(token, `/league/${LEAGUE_KEY}/teams/roster`),
    yf(token, `/league/${LEAGUE_KEY}/draftresults`),
  ])


  const settings = parseSettings(settingsRaw)
  const standings = parseStandings(standingsRaw)
  const rosters = parseRosters(rostersRaw)
  const draftPicks = parseDraft(draftRaw)

  const playerMap = {}
  rosters.forEach(({ teamKey, name: teamName, roster }) => {
    roster.forEach((p) => { playerMap[p.playerKey] = { ...p, teamKey, teamName } })
  })
  const teamNameMap = Object.fromEntries(standings.map((t) => [t.teamKey, t.name]))

  const draft = draftPicks.map((pick) => ({
    ...pick,
    teamName: teamNameMap[pick.teamKey] ?? pick.teamKey,
    player: playerMap[pick.playerKey] ?? { playerKey: pick.playerKey },
  }))

  res.json({ leagueKey: LEAGUE_KEY, settings, standings, rosters, draft })
}
