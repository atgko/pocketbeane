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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = await getValidToken(req, res)
  if (!token) return res.status(401).json({ error: 'Not connected to Yahoo' })

  const { league_id, sport = 'nba' } = req.query
  if (!league_id) return res.status(400).json({ error: 'league_id required' })

  try {
  // Discover the game key from the user's game history — this is a bare
  // /games lookup (no /leagues sub-resource expansion), which can succeed
  // even when the bulk /games;game_codes={sport}/leagues call in
  // my-leagues.js 403s for a brand-new season Yahoo hasn't opened for
  // account-wide league browsing yet.
  const gamesData = await yahooFetch(token, `/users;use_login=1/games;game_codes=${sport}`)
  const games = gamesData?.fantasy_content?.users?.[0]?.user?.[1]?.games
  const gameCount = games?.count ?? 0

  let gameKey = null
  for (let i = 0; i < gameCount; i++) {
    const game = games[i]?.game?.[0]
    if (game?.code === sport) {
      // Pick the most recent season
      if (!gameKey || game.season > gameKey.season) {
        gameKey = { key: game.game_key, season: game.season }
      }
    }
  }

  if (!gameKey) return res.status(404).json({ error: `No ${sport.toUpperCase()} game found for this account` })

  const leagueKey = `${gameKey.key}.l.${league_id}`
  const leagueData = await yahooFetch(token, `/league/${leagueKey}`)
  const league = leagueData?.fantasy_content?.league?.[0]

  res.json({ leagueKey, league })
  } catch (err) {
    const cause = err.cause?.message ?? err.cause ?? ''
    console.error('[yahoo/league] error:', err.message, cause ? `| cause: ${cause}` : '')
    res.status(502).json({ error: cause ? `${err.message}: ${cause}` : err.message })
  }
}
