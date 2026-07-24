import { getValidToken } from '@/utils/yahooAuth'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  let token
  try {
    token = await getValidToken(req, res)
  } catch (err) {
    // Refresh call itself failed (network blip, Yahoo outage) — the cookie
    // may still be a valid, un-refreshed token. Don't report disconnected
    // for a transient error unrelated to whether the user is connected.
    console.error('[yahoo/me] token refresh failed', err.message ?? err)
    return res.json({ connected: false, error: 'refresh_failed' })
  }

  if (!token) return res.json({ connected: false })

  // Cookie is present and valid — the user is connected regardless of
  // whether we can reach Yahoo's profile endpoint right now. Fetch the
  // screen name best-effort only; a network hiccup here must not flip
  // the connected state back to false.
  try {
    const profileRes = await fetch(
      'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games?format=json',
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    )
    if (!profileRes.ok) return res.json({ connected: true, screenName: null })

    const data = await profileRes.json()
    const screenName =
      data?.fantasy_content?.users?.['0']?.user?.[0]?.screen_name ?? 'Yahoo Account'

    res.json({ connected: true, screenName })
  } catch (err) {
    console.error('[yahoo/me] profile fetch failed', err.message ?? err)
    res.json({ connected: true, screenName: null })
  }
}
