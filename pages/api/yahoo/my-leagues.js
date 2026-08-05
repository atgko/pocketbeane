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

const SPORT_GAME_CODES = { nba: 'nba', mlb: 'mlb', nfl: 'nfl' }

// Core sync logic, extracted so src/platforms/yahoo/adapter.js can call it
// directly instead of duplicating this parsing — the route handler below is
// now a thin req/res wrapper around this same function, same HTTP contract
// as before.
export async function fetchMyLeagues(token, { sport = 'nba' } = {}) {
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

  return { leagues: filtered }
  } catch (err) {
    const cause = err.cause?.message ?? err.cause ?? ''
    console.error('[my-leagues] error:', err.message, cause ? `| cause: ${cause}` : '')

    // Same signal as sync-rosters.js/sync-draft.js: once the account's most
    // recent season for this sport is fully concluded, Yahoo 403s the whole
    // games;game_codes={sport}/leagues lookup, not just per-league calls —
    // there's nothing "current" left to list until the next season opens.
    // Return this shape distinctly instead of silently returning an empty
    // list the client can't tell apart from "you just have no leagues yet."
    const is403 = /\b403\b/.test(err.message) || /\b403\b/.test(cause)
    if (is403) {
      return { leagues: [], seasonOver: true }
    }

    throw err
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = await getValidToken(req, res)
  if (!token) return res.status(401).json({ error: 'Not connected to Yahoo' })

  const sport = req.query.sport ?? 'nba'

  try {
    const result = await fetchMyLeagues(token, { sport })
    res.json(result)
  } catch (err) {
    const cause = err.cause?.message ?? err.cause ?? ''
    res.status(502).json({ error: cause ? `${err.message}: ${cause}` : err.message })
  }
}
