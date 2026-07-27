import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { getSportConfig, getPlayerFile } from '@/config/sports'
import { formatRosterLine, formatRosterConfigLine, CURRENT_SEASON_REASONING_INSTRUCTION, IL_STASH_REASONING_INSTRUCTION } from '@/ai/seasonStats'
import { normalizeName } from '@/utils/playerName'
import { aggregateCategoryTotals, getCategoryWinRates } from '@/utils/teamStanding'

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

export async function getTradeValueIndex({ sport = 'nba', leagueRosters, gmProfile, rosterConfig }) {
  if (!leagueRosters?.teams) throw new Error('leagueRosters required')

  const userTeam = leagueRosters.teams.find(t => t.isUser)
  if (!userTeam) throw new Error('User team not found in rosters')

  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', getPlayerFile(sport)), 'utf8'))
  const playerByName = {}
  for (const p of players) playerByName[normalizeName(p.name)] = p

  function lineFor(entry) {
    const p = playerByName[normalizeName(entry.name)]
    return formatRosterLine(entry, p, sport)
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

  // Deterministic per-team category weaknesses (season-long prior_season
  // totals, not model judgment) — gives job #3 below real signal about what
  // each opponent actually needs, on top of the sell-high/buy-low value
  // scan above. Doesn't touch jobs #1/#2's existing logic.
  const allTeamTotals = {}
  for (const team of leagueRosters.teams) {
    const resolvedPlayers = team.roster.map(r => playerByName[normalizeName(r.name)])
    allTeamTotals[team.teamKey] = aggregateCategoryTotals(resolvedPlayers, sportConfig.categories, sportConfig.percentageCategories)
  }
  const opponentWeaknessLines = otherTeams.map(team => {
    const winRates = getCategoryWinRates({
      teamKey: team.teamKey,
      allTeamTotals,
      categories: sportConfig.categories,
      lowerIsBetter: sportConfig.lowerIsBetter,
    })
    const weakCategories = sportConfig.categories
      .map(c => ({ label: c.label, rate: winRates[c.id]?.rate }))
      .filter(c => c.rate != null)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3)
      .map(c => c.label)
    return `${team.teamName}: weakest in ${weakCategories.length ? weakCategories.join(', ') : 'no clear weakness yet (thin data)'}`
  })

  const systemPrompt = `You are Billy Beane running a trade-value scan for a ${sportLabel} GM.

Three jobs:
1. SELL-HIGH — scan MY roster for players whose current trade value is elevated relative to what they'll likely sustain: a current-season trend of "improving" or "slightly-improving" well beyond what their prior-season baseline or ADP would predict, or a hot streak unlikely to hold. These are players I should shop around now, while the market values them highest. A player performing exactly to their established level is not a sell-high candidate — this is specifically about overperformance.
2. BUY-LOW TARGETS — scan every OTHER team's roster (never my own — a buy-low target must belong to a different team, since I can't trade for a player I already own) for players whose current output understates their real level: real draft capital or established prior-season production, but a "declining" or "slightly-declining" current trend from a slump, role change, or bad luck rather than a genuine skill collapse. These are players worth trying to acquire in trades while their perceived value is depressed. Do not flag players who are declining because they've genuinely lost their role or are aging out — that's not a buy-low, that's a real decline.
3. TRADE OPPORTUNITY FLAGS — cross-reference the sell-high/buy-low signal from jobs 1-2 against each opponent's deterministic category weaknesses (given below as season-long roster totals, not your judgment) to surface at most 2 SPECIFIC trades worth pursuing right now: a case where a buy-low or sell-high player's team happens to be weak in a category my roster could exploit or fill by trading for/with them. Only flag a real fit where the value signal and the category need actually line up — don't force one if nothing genuinely fits.

Pick at most 3 sell-high candidates and at most 5 buy-low targets — only include real signal, don't pad the list. Trade value is about more than one stat line: weigh draft capital, role, and current form together, the same way you'd judge whether a player is droppable on waivers.

${CURRENT_SEASON_REASONING_INSTRUCTION}

${IL_STASH_REASONING_INSTRUCTION}

Reply ONLY with raw JSON — no markdown, no extra text:
{"headline":"1 sentence framing the state of my roster's trade value","sellHigh":[{"player":"Player Name","reason":"1-2 sentences Beane voice"}],"buyLowTargets":[{"player":"Player Name","currentTeam":"Team Name","reason":"1-2 sentences Beane voice"}],"tradeOpportunityFlags":[{"team":"Team Name","player":"Player Name","reason":"1-2 sentences on why this specific trade fits both sides right now"}]}`

  const userPrompt = `${sportLabel} league · Categories: ${catLine}${gmLine}${formatRosterConfigLine(rosterConfig)}

MY ROSTER (${userTeam.teamName}):
${myRosterLines.join('\n')}

OTHER ROSTERS IN THE LEAGUE:
${leagueRosterLines.join('\n\n')}

OPPONENT CATEGORY WEAKNESSES (deterministic, season-long roster totals):
${opponentWeaknessLines.join('\n')}

Run the trade-value scan.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    // Bumped from 1100 (see league-pulse.js's T3-5 fix for the same root
    // cause) — 3 jobs' worth of output (up to 3 sell-high + 5 buy-low + 2
    // trade flags, each with a reason) was truncating mid-JSON on larger
    // leagues, surfacing as "Malformed JSON in model response".
    max_tokens: 2000,
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

  // The prompt asks for "at most 2" — enforce it rather than trust it, same
  // spirit as the buyLowTargets guardrail above.
  if (Array.isArray(result.tradeOpportunityFlags)) {
    result.tradeOpportunityFlags = result.tradeOpportunityFlags.slice(0, 2)
  }

  return result
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sport = 'nba', leagueRosters, gmProfile, rosterConfig } = req.body

  try {
    const index = await getTradeValueIndex({ sport, leagueRosters, gmProfile, rosterConfig })
    res.json(index)
  } catch (err) {
    console.error('[trade-value-index]', err)
    const status = ['leagueRosters required', 'User team not found in rosters'].includes(err.message) ? 400 : 500
    res.status(status).json({ error: err.message })
  }
}
