import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const COOKIE_NAME = 'ytoken'

function getKey() {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY not set')
  return Buffer.from(key, 'hex')
}

export function encryptToken(payload) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptToken(ciphertext) {
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}

export function setTokenCookie(res, tokenData) {
  const encrypted = encryptToken(tokenData)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${encrypted}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`
  )
}

export function clearTokenCookie(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  )
}

export function getTokenFromCookie(req) {
  const raw = req.cookies?.[COOKIE_NAME]
  if (!raw) return null
  try {
    return decryptToken(raw)
  } catch {
    return null
  }
}

export async function refreshYahooToken(refreshToken) {
  const credentials = Buffer.from(
    `${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Yahoo token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    // Yahoo sometimes omits a new refresh token — keep the existing one
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  }
}

// Returns a valid token, refreshing and re-setting the cookie if it's within 5 minutes of expiry.
export async function getValidToken(req, res) {
  const token = getTokenFromCookie(req)
  if (!token) return null

  if (token.expires_at - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshYahooToken(token.refresh_token)
    setTokenCookie(res, refreshed)
    return refreshed
  }

  return token
}
