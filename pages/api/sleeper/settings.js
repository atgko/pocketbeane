// Mirrors pages/api/yahoo/settings.js's shape exactly (statCategories,
// rosterPositions, numTeams, leagueName, draftType, auctionBudget,
// scoringType) so setup.jsx's league-select handler works unchanged
// regardless of which platform the league came from. Also includes
// draftId (Sleeper-specific — see types.js), which setup.jsx stores on the
// league config for sync-draft.js and the future live-draft polling step.
import { getPlatform } from '@/platforms'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { leagueId } = req.query
  if (!leagueId) return res.status(400).json({ error: 'leagueId required' })

  try {
    const adapter = getPlatform('sleeper')
    const league = await adapter.getLeague(leagueId)
    if (!league) return res.status(404).json({ error: `No Sleeper league found for id "${leagueId}"` })

    res.json({ ...league.settings, draftId: league.draftId })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
