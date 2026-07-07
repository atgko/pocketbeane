import { Resend } from 'resend'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'PocketBeane <onboarding@resend.dev>'

export async function sendEmail({ to, subject, html, type = 'generic' }) {
  if (!to || !subject || !html) {
    throw new Error('Missing required email fields: to, subject, html')
  }
  if (!process.env.RESEND_API_KEY) {
    console.error(`[send-email:${type}] RESEND_API_KEY is not configured`)
    throw new Error('Email sending is not configured (missing RESEND_API_KEY)')
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html })

  if (error) {
    console.error(`[send-email:${type}]`, error.message ?? error)
    throw new Error(error.message ?? 'Resend send failed')
  }

  return { success: true, id: data?.id ?? null }
}
