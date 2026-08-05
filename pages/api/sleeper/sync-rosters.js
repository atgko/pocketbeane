// Mirrors pages/api/yahoo/sync-rosters.js's response shape exactly
// ({ teams, userTeamKey, matched, total, isSeasonOver, syncedAt }) so
// Season Hub / draft board components consume it identically regardless of
// platform. `userId` is the resolved Sleeper user_id stored on the league
// config at onboarding — needed to compute isUser/userTeamKey since
// Sleeper (unlike Yahoo's OAuth session) has no server-side notion of
// "who's asking."
import { getPlatform } from '@/platforms'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { leagueId, userId } = req.query
  if (!leagueId) return res.status(400).json({ error: 'leagueId required' })

  try {
    const adapter = getPlatform('sleeper', { userId })
    const result = await adapter.getRosters(leagueId)
    res.json(result)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
