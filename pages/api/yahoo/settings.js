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

function parseSettings(data) {
  const raw = data?.fantasy_content?.league
  if (!raw) return null
  const meta = raw[0]
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
  return {
    statCategories,
    rosterPositions,
    numTeams: meta?.num_teams ? Number(meta.num_teams) : null,
    leagueName: meta?.name ?? null,
    draftType: meta?.draft_type ?? null,
    auctionBudget: meta?.draft_type === 'auction' ? Number(meta.faar_budget ?? 200) : null,
    scoringType: meta?.scoring_type ?? null,
  }
}

// Core sync logic, extracted so src/platforms/yahoo/adapter.js can call it
// directly instead of duplicating this parsing — the route handler below is
// now a thin req/res wrapper around this same function, same HTTP contract
// as before.
export async function fetchSettings(token, { leagueKey }) {
  try {
    const data = await yahooFetch(token, `/league/${leagueKey}/settings`)
    return parseSettings(data)
  } catch (err) {
    const cause = err.cause?.message ?? err.cause ?? ''
    console.error('[yahoo/settings] error:', err.message, cause ? `| cause: ${cause}` : '')

    // Same signal as sync-rosters.js/sync-draft.js/my-leagues.js: Yahoo 403s
    // /league/{key}/settings once that league's season is fully concluded.
    // Unlike those endpoints there's no cached snapshot to fall back on here
    // — this is the entry point for adding a league PocketBeane has never
    // seen before — so return this shape instead of throwing so callers can
    // tell the client plainly instead of forwarding the raw Yahoo error text.
    const is403 = /\b403\b/.test(err.message) || /\b403\b/.test(cause)
    if (is403) {
      return { seasonOver: true, error: "This league's season has already ended, so Yahoo no longer allows syncing its settings." }
    }

    throw err
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = await getValidToken(req, res)
  if (!token) return res.status(401).json({ error: 'Not connected to Yahoo' })

  const { league_key } = req.query
  if (!league_key) return res.status(400).json({ error: 'league_key required' })

  try {
    const settings = await fetchSettings(token, { leagueKey: league_key })
    if (!settings) return res.status(500).json({ error: 'Failed to parse league settings' })
    res.json(settings)
  } catch (err) {
    const cause = err.cause?.message ?? err.cause ?? ''
    res.status(502).json({ error: cause ? `${err.message}: ${cause}` : err.message })
  }
}
