export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const params = new URLSearchParams({
    client_id: process.env.YAHOO_CLIENT_ID,
    redirect_uri: process.env.YAHOO_REDIRECT_URI,
    response_type: 'code',
    scope: 'fspt-r',
  })

  res.redirect(`https://api.login.yahoo.com/oauth2/request_auth?${params}`)
}
