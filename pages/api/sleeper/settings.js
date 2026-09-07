// Mirrors pages/api/yahoo/settings.js's shape exactly (statCategories,
// rosterPositions, numTeams, leagueName, draftType, auctionBudget,
// scoringType) so setup.jsx's league-select handler works unchanged
// regardless of which platform the league came from. Also includes
// draftId (Sleeper-specific — see types.js), which setup.jsx stores on the
// league config for sync-draft.js and the future live-draft polling step.
import { getPlatform } from '@/platforms'

// Sleeper's default per-team auction budget, matching Sleeper's own default
// league setting — same fallback role as yahoo/settings.js's `?? 200`.
const DEFAULT_AUCTION_BUDGET = 200

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { leagueId } = req.query
  if (!leagueId) return res.status(400).json({ error: 'leagueId required' })

  try {
    const adapter = getPlatform('sleeper')
    const league = await adapter.getLeague(leagueId)
    if (!league) return res.status(404).json({ error: `No Sleeper league found for id "${leagueId}"` })

    // draftType/auctionBudget live on the draft resource, not the league
    // resource (Sleeper doesn't expose snake-vs-auction on the league itself
    // — see normalize.js's normalizeSettings header), so fetch it separately
    // when a draftId exists. auctionBudget's real field is UNVERIFIED — see
    // normalizeDraft()'s comment — this just falls back to $200 when unknown.
    let draftType = null
    let auctionBudget = null
    if (league.draftId) {
      const draft = await adapter.getDraft(league.draftId)
      draftType = draft?.type ?? null
      if (draftType === 'auction') {
        auctionBudget = draft?.budget ?? DEFAULT_AUCTION_BUDGET
      }
    }

    res.json({ ...league.settings, draftType, auctionBudget, draftId: league.draftId })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
