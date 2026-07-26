import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { getSportConfig, getPlayerFile } from '@/config/sports'
import { formatRosterLine, formatRosterConfigLine, CURRENT_SEASON_REASONING_INSTRUCTION, IL_STASH_REASONING_INSTRUCTION } from '@/ai/seasonStats'
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

export async function getTradeAdvice({ sport = 'nba', leagueRosters, give, receive, gmProfile, rosterConfig }) {
  if (!leagueRosters?.teams) throw new Error('leagueRosters required')
  if (!give?.length || !receive?.length) throw new Error('give and receive players required')

  const userTeam = leagueRosters.teams.find(t => t.isUser)
  if (!userTeam) throw new Error('User team not found in rosters')

  // "Give" players must all be on the user's own roster.
  const userRosterByName = new Map(userTeam.roster.map(r => [normalizeName(r.name), r]))
  const missingGive = give.filter(n => !userRosterByName.has(normalizeName(n)))
  if (missingGive.length) {
    throw new Error(`These aren't on your roster: ${missingGive.join(', ')}`)
  }

  // "Receive" players must all belong to the same single opposing team.
  const otherTeams = leagueRosters.teams.filter(t => !t.isUser)
  let partnerTeam = null
  for (const team of otherTeams) {
    const names = new Set(team.roster.map(r => normalizeName(r.name)))
    if (receive.every(n => names.has(normalizeName(n)))) {
      partnerTeam = team
      break
    }
  }
  if (!partnerTeam) {
    throw new Error(
      `Couldn't find a single team rostering all of: ${receive.join(', ')}. Check spelling — a trade only involves one other team.`
    )
  }
  const partnerRosterByName = new Map(partnerTeam.roster.map(r => [normalizeName(r.name), r]))

  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', getPlayerFile(sport)), 'utf8'))
  const playerByName = {}
  for (const p of players) playerByName[normalizeName(p.name)] = p

  function lineFor(entry) {
    const p = playerByName[normalizeName(entry.name)]
    return formatRosterLine(entry, p, sport)
  }

  const giveEntries = give.map(n => userRosterByName.get(normalizeName(n)))
  const receiveEntries = receive.map(n => partnerRosterByName.get(normalizeName(n)))

  const giveLines = giveEntries.map(lineFor)
  const receiveLines = receiveEntries.map(lineFor)
  const myRosterLines = userTeam.roster.map(lineFor)
  const partnerRosterLines = partnerTeam.roster.map(lineFor)

  const sportConfig = getSportConfig(sport)
  const catLine = sportConfig.categories
    .map(c => `${c.label}${sportConfig.lowerIsBetter?.includes(c.id) ? '↓' : ''}`)
    .join(', ')
  const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'

  const gmLine = gmProfile?.injuryTolerance
    ? `\nGM Profile: injury tolerance = ${gmProfile.injuryTolerance}, strategy = ${gmProfile.draftStrategy ?? 'balanced'}.`
    : ''

  const systemPrompt = `You are Billy Beane evaluating a proposed trade for a ${sportLabel} GM.

I am considering giving up certain players in exchange for others from one opponent. Evaluate the trade honestly — I proposed it, but that does not make it good for me. Weigh three things: (1) net category impact on my full roster — which categories improve, decline, or stay neutral once the swap happens; (2) whether this fills a real positional/roster need or just creates a new hole; (3) whether either side of the trade is a buy-low opportunity (acquiring a player whose current output understates their real level, likely to regress upward) or a sell-high opportunity (moving a player whose current output is unlikely to hold), based on current-season vs prior-season trends where available. Trade value is about more than a single stat line — weigh draft capital, role, and current form together, the same way you would when deciding whether a player is droppable on waivers.

${CURRENT_SEASON_REASONING_INSTRUCTION}

${IL_STASH_REASONING_INSTRUCTION}

Reply ONLY with raw JSON — no markdown, no extra text:
{"verdict":"accept|lean-accept|lean-decline|decline","outlook":"2-3 sentence narrative","improveCategories":["PTS","AST"],"declineCategories":["BLK"],"neutralCategories":["REB"],"positionalNote":"1-2 sentences on roster balance/need","buyLowSellHighNote":"1-2 sentences on which side of the trade (if either) has the buy-low/sell-high edge","reason":"2-3 sentence Beane-voice bottom line"}`

  const userPrompt = `${sportLabel} league · Categories: ${catLine}${gmLine}${formatRosterConfigLine(rosterConfig)}

PROPOSED TRADE
I give: ${giveLines.join(' | ')}
I receive (from ${partnerTeam.teamName}): ${receiveLines.join(' | ')}

MY FULL ROSTER (${userTeam.teamName}):
${myRosterLines.join('\n')}

${partnerTeam.teamName}'S FULL ROSTER:
${partnerRosterLines.join('\n')}

Evaluate this trade.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: [{ type: 'text', text: systemPrompt }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = message.content[0]?.text ?? ''
  return { ...extractJSON(text), partnerTeamName: partnerTeam.teamName }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sport = 'nba', leagueRosters, give, receive, gmProfile, rosterConfig } = req.body

  try {
    const advice = await getTradeAdvice({ sport, leagueRosters, give, receive, gmProfile, rosterConfig })
    res.json(advice)
  } catch (err) {
    console.error('[trade-advice]', err)
    const clientError =
      err.message === 'leagueRosters required' ||
      err.message === 'give and receive players required' ||
      err.message === 'User team not found in rosters' ||
      err.message.startsWith("These aren't on your roster") ||
      err.message.startsWith("Couldn't find a single team")
    res.status(clientError ? 400 : 500).json({ error: err.message })
  }
}
