// Lists a Sleeper user's NFL leagues for a season — mirrors
// pages/api/yahoo/my-leagues.js's shape ({ leagues: [...] }) so the setup
// page can render both platforms' league pickers with the same component.
// NFL only — see memory project_sleeper_integration_scope.
import { getPlatform } from '@/platforms'

const CURRENT_SEASON = new Date().getFullYear().toString()

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { userId, season = CURRENT_SEASON } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const adapter = getPlatform('sleeper')
    const leagues = await adapter.getUserLeagues(userId, 'nfl', season)
    res.json({ leagues })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
