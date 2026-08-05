// Resolves a Sleeper username to its stable user_id — the one Sleeper
// identity lookup every onboarding flow needs. Usernames can change;
// user_ids don't, so this is called once and the result (user_id) is what
// gets stored on the league config, never the username itself.
import { getPlatform } from '@/platforms'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { username } = req.query
  if (!username) return res.status(400).json({ error: 'username required' })

  try {
    const adapter = getPlatform('sleeper')
    const user = await adapter.resolveUsername(username)
    if (!user) return res.status(404).json({ error: `No Sleeper user found for username "${username}"` })

    res.json({ userId: user.user_id, username: user.username, displayName: user.display_name })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
