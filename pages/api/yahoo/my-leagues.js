import { getValidToken } from '@/utils/yahooAuth'

async function yahooFetch(token, path) {
  const res = await fetch(
    `https://fantasysports.yahooapis.com/fantasy/v2${path}?format=json`,
    { headers: { Authorization: `Bearer ${token.access_token}` } }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Yahoo API ${res.status}: ${text}`)
  }
  return res.json()
}

const SPORT_GAME_CODES = { nba: 'nba', mlb: 'mlb' }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = await getValidToken(req, res)
  if (!token) return res.status(401).json({ error: 'Not connected to Yahoo' })

  const sport = req.query.sport ?? 'nba'
  const gameCode = SPORT_GAME_CODES[sport] ?? 'nba'

  try {
  const data = await yahooFetch(token, `/users;use_login=1/games;game_codes=${gameCode}/leagues`)
  const games = data?.fantasy_content?.users?.[0]?.user?.[1]?.games
  const gameCount = games?.count ?? 0

  const leagues = []
  for (let i = 0; i < gameCount; i++) {
    const gameArr = games[i]?.game
    if (!gameArr) continue
    const gameMeta = gameArr[0]
    if (gameMeta?.code !== gameCode) continue

    const leaguesObj = gameArr[1]?.leagues
    const leagueCount = leaguesObj?.count ?? 0
    for (let j = 0; j < leagueCount; j++) {
      const meta = leaguesObj[j]?.league?.[0]
      if (meta) {
        leagues.push({
          leagueKey: meta.league_key,
          leagueId: meta.league_id,
          name: meta.name,
          numTeams: meta.num_teams,
          season: gameMeta.season,
        })
      }
    }
  }

  leagues.sort((a, b) => b.season - a.season)

  // Only show the most recent season
  const latestSeason = leagues[0]?.season
  const filtered = latestSeason ? leagues.filter((l) => l.season === latestSeason) : leagues

  res.json({ leagues: filtered })
  } catch (err) {
    const cause = err.cause?.message ?? err.cause ?? ''
    console.error('[my-leagues] error:', err.message, cause ? `| cause: ${cause}` : '')
    res.status(502).json({ error: cause ? `${err.message}: ${cause}` : err.message })
  }
}
