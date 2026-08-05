// Mirrors pages/api/yahoo/sync-draft.js's response shape exactly
// ({ picks, userTeamKey, draftPosition, matched, total }). `draftId` comes
// from settings.js's response at league-select time (Sleeper's draft isn't
// addressable by leagueId — see types.js's NormalizedLeague.draftId).
import { getPlatform } from '@/platforms'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { draftId, userId } = req.query
  if (!draftId) return res.status(400).json({ error: 'draftId required' })

  try {
    const adapter = getPlatform('sleeper', { userId })
    const result = await adapter.getDraftPicks(draftId)
    res.json(result)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
