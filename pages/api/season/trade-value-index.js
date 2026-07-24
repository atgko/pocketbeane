import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { getSportConfig, getPlayerFile } from '@/config/sports'
import { formatStats, formatCurrentSeasonLine, CURRENT_SEASON_REASONING_INSTRUCTION } from '@/ai/seasonStats'
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

export async function getTradeValueIndex({ sport = 'nba', leagueRosters, gmProfile }) {
  if (!leagueRosters?.teams) throw new Error('leagueRosters required')

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

  const myRosterLines = userTeam.roster.map(lineFor)

  const otherTeams = leagueRosters.teams.filter(t => !t.isUser)
  const leagueRosterLines = otherTeams.map(team =>
    `${team.teamName}:\n${team.roster.map(lineFor).join('\n')}`
  )

  const sportConfig = getSportConfig(sport)
  const catLine = sportConfig.categories
    .map(c => `${c.label}${sportConfig.lowerIsBetter?.includes(c.id) ? '↓' : ''}`)
    .join(', ')
  const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'

  const gmLine = gmProfile?.injuryTolerance
    ? `\nGM Profile: injury tolerance = ${gmProfile.injuryTolerance}, strategy = ${gmProfile.draftStrategy ?? 'balanced'}.`
    : ''

  const systemPrompt = `You are Billy Beane running a trade-value scan for a ${sportLabel} GM.

Two jobs:
1. SELL-HIGH — scan MY roster for players whose current trade value is elevated relative to what they'll likely sustain: a current-season trend of "improving" or "slightly-improving" well beyond what their prior-season baseline or ADP would predict, or a hot streak unlikely to hold. These are players I should shop around now, while the market values them highest. A player performing exactly to their established level is not a sell-high candidate — this is specifically about overperformance.
2. BUY-LOW TARGETS — scan every OTHER team's roster (never my own — a buy-low target must belong to a different team, since I can't trade for a player I already own) for players whose current output understates their real level: real draft capital or established prior-season production, but a "declining" or "slightly-declining" current trend from a slump, role change, or bad luck rather than a genuine skill collapse. These are players worth trying to acquire in trades while their perceived value is depressed. Do not flag players who are declining because they've genuinely lost their role or are aging out — that's not a buy-low, that's a real decline.

Pick at most 3 sell-high candidates and at most 5 buy-low targets — only include real signal, don't pad the list. Trade value is about more than one stat line: weigh draft capital, role, and current form together, the same way you'd judge whether a player is droppable on waivers.

${CURRENT_SEASON_REASONING_INSTRUCTION}

Reply ONLY with raw JSON — no markdown, no extra text:
{"headline":"1 sentence framing the state of my roster's trade value","sellHigh":[{"player":"Player Name","reason":"1-2 sentences Beane voice"}],"buyLowTargets":[{"player":"Player Name","currentTeam":"Team Name","reason":"1-2 sentences Beane voice"}]}`

  const userPrompt = `${sportLabel} league · Categories: ${catLine}${gmLine}

MY ROSTER (${userTeam.teamName}):
${myRosterLines.join('\n')}

OTHER ROSTERS IN THE LEAGUE:
${leagueRosterLines.join('\n\n')}

Run the trade-value scan.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system: [{ type: 'text', text: systemPrompt }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = message.content[0]?.text ?? ''
  const result = extractJSON(text)

  // Server-side guardrail: the model occasionally suggests "buying low" on a
  // player who is already on the user's own roster, which is meaningless —
  // buy-low targets must come from another team. Drop any that slip through.
  const myRosterNames = new Set(userTeam.roster.map(r => normalizeName(r.name)))
  if (Array.isArray(result.buyLowTargets)) {
    result.buyLowTargets = result.buyLowTargets.filter(t => !myRosterNames.has(normalizeName(t.player)))
  }

  return result
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sport = 'nba', leagueRosters, gmProfile } = req.body

  try {
    const index = await getTradeValueIndex({ sport, leagueRosters, gmProfile })
    res.json(index)
  } catch (err) {
    console.error('[trade-value-index]', err)
    const status = ['leagueRosters required', 'User team not found in rosters'].includes(err.message) ? 400 : 500
    res.status(status).json({ error: err.message })
  }
}
