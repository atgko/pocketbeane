import { getWaiverAdvice } from './waiver-advice'
import { sendEmail } from '@/server/email'

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ISO 8601 week number — good enough for a scannable digest subject line.
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

function buildDigestHtml(leagueName, week, headline, moves) {
  const rows = moves.slice(0, 3).map(m => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #2a2a2a;">
        <p style="margin:0;font-size:14px;color:#e5e5e5;">
          <strong style="color:#22c55e;">+ ${m.add}</strong>${m.drop ? ` <span style="color:#666;">&middot;</span> <strong style="color:#f87171;">&minus; ${m.drop}</strong>` : ''}
        </p>
        <p style="margin:6px 0 0;font-size:13px;color:#999;line-height:1.5;">${m.reason}</p>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
  <body style="background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px 16px;margin:0;">
    <div style="max-width:480px;margin:0 auto;">
      <p style="color:#3b82f6;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 6px;">${leagueName}</p>
      <h1 style="color:#fff;font-size:20px;margin:0 0 16px;">Week ${week} Waiver Wire Picks</h1>
      ${headline ? `<p style="color:#999;font-size:13px;font-style:italic;margin:0 0 20px;line-height:1.5;">${headline}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="color:#555;font-size:11px;margin-top:28px;">&mdash; Beane, via PocketBeane</p>
    </div>
  </body>
</html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, leagueName = 'Your League', sport = 'nba', leagueRosters, gmProfile } = req.body

  if (!isValidEmail(to)) {
    return res.status(400).json({ error: 'Valid recipient email required' })
  }
  if (!leagueRosters?.teams) {
    return res.status(400).json({ error: 'leagueRosters required' })
  }

  try {
    const advice = await getWaiverAdvice({ sport, leagueRosters, gmProfile })
    const week = getWeekNumber(new Date())
    const html = buildDigestHtml(leagueName, week, advice.headline, advice.moves ?? [])
    const subject = `Your Week ${week} Waiver Wire Picks — ${leagueName}`

    const result = await sendEmail({ to, subject, html, type: 'waiver-digest' })
    res.json({ ...result, week })
  } catch (err) {
    console.error('[email-waiver-digest]', err)
    res.status(500).json({ error: err.message || 'Failed to send digest' })
  }
}
