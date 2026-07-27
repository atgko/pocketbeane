import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { getSportConfig, getPlayerFile } from '@/config/sports'
import { formatRosterLine, formatRosterConfigLine } from '@/ai/seasonStats'
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

export async function getLeaguePulse({ sport = 'nba', leagueRosters, gmProfile, rosterConfig }) {
  if (!leagueRosters?.teams) throw new Error('leagueRosters required')
  if (leagueRosters.teams.length < 2) throw new Error('Need at least 2 teams to summarize the league')

  const userTeam = leagueRosters.teams.find(t => t.isUser)
  if (!userTeam) throw new Error('User team not found in rosters')

  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', getPlayerFile(sport)), 'utf8'))
  const playerByName = {}
  for (const p of players) playerByName[normalizeName(p.name)] = p

  function lineFor(entry) {
    const p = playerByName[normalizeName(entry.name)]
    return formatRosterLine(entry, p, sport)
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

  // Deterministic category strengths/weaknesses for MY team specifically —
  // same aggregateCategoryTotals/getCategoryWinRates approach already used
  // for opponent weaknesses in trade-value-index.js. Feeds the "my team
  // take" job below real signal instead of leaving the model to guess at
  // strongest/weakest categories from raw roster lines.
  const allTeamTotals = {}
  for (const team of leagueRosters.teams) {
    const resolvedPlayers = team.roster.map(r => playerByName[normalizeName(r.name)])
    allTeamTotals[team.teamKey] = aggregateCategoryTotals(resolvedPlayers, sportConfig.categories, sportConfig.percentageCategories)
  }
  const myWinRates = getCategoryWinRates({
    teamKey: userTeam.teamKey,
    allTeamTotals,
    categories: sportConfig.categories,
    lowerIsBetter: sportConfig.lowerIsBetter,
  })
  const myRankedCategories = sportConfig.categories
    .map(c => ({ label: c.label, rate: myWinRates[c.id]?.rate }))
    .filter(c => c.rate != null)
    .sort((a, b) => b.rate - a.rate)
  const myStrengthLine = myRankedCategories.length
    ? `Strongest: ${myRankedCategories.slice(0, 3).map(c => `${c.label} (beats ${Math.round(c.rate * 100)}% of the league)`).join(', ')}`
    : 'Strongest: not enough data yet'
  const myWeaknessLine = myRankedCategories.length
    ? `Weakest: ${myRankedCategories.slice(-3).reverse().map(c => `${c.label} (beats ${Math.round(c.rate * 100)}% of the league)`).join(', ')}`
    : 'Weakest: not enough data yet'

  // Rough weeks-remaining figure from each sport's approximate season end
  // date (SPORT_CONFIGS.seasonEndDate) — omitted from the prompt entirely
  // when a sport has no end date configured, rather than let the model
  // invent a week count.
  let weeksRemainingLine = ''
  if (sportConfig.seasonEndDate) {
    const msRemaining = new Date(`${sportConfig.seasonEndDate}T00:00:00Z`) - new Date()
    const weeksRemaining = Math.max(0, Math.round(msRemaining / (7 * 24 * 60 * 60 * 1000)))
    weeksRemainingLine = `\nApproximately ${weeksRemaining} week${weeksRemaining === 1 ? '' : 's'} remaining in the season (season ends ~${sportConfig.seasonEndDate}).`
  }

  const systemPrompt = `You are Billy Beane delivering a weekly league-wide pulse check to a ${sportLabel} GM (me).

Four jobs:
1. DOMINATING — which teams are genuinely dominating (strong record backed by real roster quality, not just early-season luck).
2. REBUILDING — which teams are weak or clearly rebuilding (bad record and/or thin roster).
3. TRADE OPPORTUNITIES — which specific teams look like plausible trade partners for ME right now — teams whose roster strengths/needs could complement mine (they're weak where I'm strong, or strong where I have a surplus), or contenders/rebuilders whose incentives point toward being open to a deal. Be specific about why a team is a fit, not generic. Don't force a trade partner if none genuinely stand out.
4. MY TEAM TAKE — always produce a grounded, substantive take on MY team specifically, regardless of whether I show up in jobs 1-2 above (a solid mid-pack team won't). Cover: how my season has gone so far given my record and rank; my real strongest and weakest categories (use the deterministic win-rate data given below — don't guess or recompute); and, given my standing and the weeks remaining in the season, whether I'm in a good playoff position and should hold what I have, or need to make moves (trade for a weak category, work the waiver wire) to address a real gap. Be specific and opinionated, not a generic one-liner — this is the main value of the whole pulse check.

Reply ONLY with raw JSON — no markdown, no extra text:
{"headline":"1-2 sentence framing of the league's current state","dominating":[{"team":"Team Name","note":"1 sentence why"}],"rebuilding":[{"team":"Team Name","note":"1 sentence why"}],"tradeOpportunities":[{"team":"Team Name","note":"1-2 sentences on the specific fit for me"}],"myTeamTake":{"summary":"2-3 sentences on how my season is going","strengths":"1 sentence on my real strongest categories and why they're winning","weaknesses":"1 sentence on my real weakest categories and what's driving it","recommendation":"1-2 sentences: am I in good playoff shape, and should I hold or make moves given the weeks left"}}`

  const userPrompt = `${sportLabel} league · Categories: ${catLine}${gmLine}${formatRosterConfigLine(rosterConfig)}

STANDINGS:
${standingsLines.join('\n')}

MY TEAM (${userTeam.teamName}) CATEGORY PERFORMANCE (deterministic, vs. rest of league):
${myStrengthLine}
${myWeaknessLine}${weeksRemainingLine}

ROSTERS:
${rosterLines.join('\n\n')}

Give me this week's league pulse.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2500,
    system: [{ type: 'text', text: systemPrompt }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = message.content[0]?.text ?? ''
  return extractJSON(text)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sport = 'nba', leagueRosters, gmProfile, rosterConfig } = req.body

  try {
    const pulse = await getLeaguePulse({ sport, leagueRosters, gmProfile, rosterConfig })
    res.json(pulse)
  } catch (err) {
    console.error('[league-pulse]', err)
    const clientErrors = ['leagueRosters required', 'Need at least 2 teams to summarize the league', 'User team not found in rosters']
    res.status(clientErrors.includes(err.message) ? 400 : 500).json({ error: err.message })
  }
}
