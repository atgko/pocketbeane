import { clearTokenCookie } from '@/utils/yahooAuth'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  clearTokenCookie(res)
  res.json({ ok: true })
}
