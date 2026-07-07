import { sendEmail } from '@/server/email'

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, subject, body, type = 'generic' } = req.body

  if (!isValidEmail(to) || !subject || !body) {
    return res.status(400).json({ error: 'Missing or invalid required fields: to, subject, body' })
  }

  try {
    const result = await sendEmail({ to, subject, html: body, type })
    res.json(result)
  } catch (err) {
    console.error(`[send-email:${type}]`, err)
    res.status(500).json({ error: err.message || 'Failed to send email' })
  }
}
