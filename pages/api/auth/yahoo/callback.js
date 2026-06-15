import { setTokenCookie } from '@/utils/yahooAuth'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { code, error } = req.query

  if (error || !code) {
    return res.redirect(`/?yahoo_error=${encodeURIComponent(error ?? 'no_code')}`)
  }

  try {
    const credentials = Buffer.from(
      `${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`
    ).toString('base64')

    const tokenRes = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.YAHOO_REDIRECT_URI,
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      throw new Error(`Token exchange failed: ${tokenRes.status} — ${text}`)
    }

    const data = await tokenRes.json()
    setTokenCookie(res, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    })

    res.redirect('/?yahoo_connected=1')
  } catch (err) {
    console.error('[yahoo/callback]', err)
    res.redirect(`/?yahoo_error=${encodeURIComponent(err.message)}`)
  }
}
