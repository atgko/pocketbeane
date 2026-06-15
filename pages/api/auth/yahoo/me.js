import { getValidToken } from '@/utils/yahooAuth'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const token = await getValidToken(req, res)
    if (!token) return res.json({ connected: false })

    const profileRes = await fetch(
      'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games?format=json',
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    )

    if (!profileRes.ok) return res.json({ connected: false })

    const data = await profileRes.json()
    const screenName =
      data?.fantasy_content?.users?.['0']?.user?.[0]?.screen_name ?? 'Yahoo Account'

    res.json({ connected: true, screenName })
  } catch {
    res.json({ connected: false })
  }
}
