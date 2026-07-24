import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { getSportConfig, getPlayerFile } from '@/config/sports'
import { formatStats, formatCurrentSeasonLine } from '@/ai/seasonStats'
import { normalizeName } from '@/utils/playerName'

const client = new Anthropic()

function extractJSON(text) {
  const candidates = [
    text.replace(/```(?:json)?\n?([\s\S]*?)```/g, '$1').trim(),
    text,
  ]
  for (const candidate of candidates) {
    const match = candidate.match(/\{[\s\S]*\}/)
    if (!match) continue
    try { return JSON.parse(match[0]) } catch {}
  }
  throw new Error('Malformed JSON in model response')
}

export async function getLeaguePulse({ sport = 'nba', leagueRosters, gmProfile }) {
  if (!leagueRosters?.teams) throw new Error('leagueRosters required')
  if (leagueRosters.teams.length < 2) throw new Error('Need at least 2 teams to summarize the league')

  const userTeam = leagueRosters.teams.find(t => t.isUser)
  if (!userTeam) throw new Error('User team not found in rosters')

  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', getPlayerFile(sport)), 'utf8'))
  const playerByName = {}
  for (const p of players) playerByName[normalizeName(p.name)] = p

  function lineFor(entry) {
    const p = playerByName[normalizeName(entry.name)]
    const injuryTag = p?.injury_risk ? ' ⚠️' : ''
    const adpTag = p?.adp != null ? `,ADP${p.adp.toFixed(1)}` : ''
    return `${entry.name}(${entry.positions ?? '?'}${adpTag}${injuryTag}): ${p ? formatStats(p, sport) : 'no stats'}${p ? formatCurrentSeasonLine(p, sport) : ''}`
  }

  const teamsSorted = [...leagueRosters.teams].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  const standingsLines = teamsSorted.map(t =>
    `${t.rank != null ? `#${t.rank}` : '?'} ${t.teamName}${t.isUser ? ' (ME)' : ''} — W${t.wins ?? 0}/L${t.losses ?? 0}${t.ties ? `/T${t.ties}` : ''}`
  )

  const rosterLines = teamsSorted.map(team =>
    `${team.teamName}${team.isUser ? ' (ME)' : ''}:\n${team.roster.map(lineFor).join('\n')}`
  )

  const sportConfig = getSportConfig(sport)
  const catLine = sportConfig.categories
    .map(c => `${c.label}${sportConfig.lowerIsBetter?.includes(c.id) ? '↓' : ''}`)
    .join(', ')
  const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'

  const gmLine = gmProfile?.injuryTolerance
    ? `\nGM Profile: injury tolerance = ${gmProfile.injuryTolerance}, strategy = ${gmProfile.draftStrategy ?? 'balanced'}.`
    : ''

  const systemPrompt = `You are Billy Beane delivering a weekly league-wide pulse check to a ${sportLabel} GM (me).

Using the standings and every team's roster, identify: (1) which teams are genuinely dominating (strong record backed by real roster quality, not just early-season luck), (2) which teams are weak or clearly rebuilding (bad record and/or thin roster), and (3) which specific teams look like plausible trade partners for ME right now — teams whose roster strengths/needs could complement mine (they're weak where I'm strong, or strong where I have a surplus), or contenders/rebuilders whose incentives point toward being open to a deal. Be specific about why a team is a fit, not generic. Don't force a trade partner if none genuinely stand out.

Reply ONLY with raw JSON — no markdown, no extra text:
{"headline":"1-2 sentence framing of the league's current state","dominating":[{"team":"Team Name","note":"1 sentence why"}],"rebuilding":[{"team":"Team Name","note":"1 sentence why"}],"tradeOpportunities":[{"team":"Team Name","note":"1-2 sentences on the specific fit for me"}]}`

  const userPrompt = `${sportLabel} league · Categories: ${catLine}${gmLine}

STANDINGS:
${standingsLines.join('\n')}

ROSTERS:
${rosterLines.join('\n\n')}

Give me this week's league pulse.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system: [{ type: 'text', text: systemPrompt }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = message.content[0]?.text ?? ''
  return extractJSON(text)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sport = 'nba', leagueRosters, gmProfile } = req.body

  try {
    const pulse = await getLeaguePulse({ sport, leagueRosters, gmProfile })
    res.json(pulse)
  } catch (err) {
    console.error('[league-pulse]', err)
    const clientErrors = ['leagueRosters required', 'Need at least 2 teams to summarize the league', 'User team not found in rosters']
    res.status(clientErrors.includes(err.message) ? 400 : 500).json({ error: err.message })
  }
}
