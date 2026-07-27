import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { getSportConfig, getPlayerFile } from '@/config/sports'
import { formatRosterLine } from '@/ai/seasonStats'
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

// One-time, end-of-season recap generated from the last roster/standings
// snapshot PocketBeane synced before Yahoo locked the league down — there's
// no live data to pull once a league is over (see BACKLOG: sync-rosters/
// sync-draft both 403 permanently at that point), so whatever was cached is
// as final as it gets. Callers are expected to persist the result and never
// call this again for the same league.
export async function getSeasonRecap({ sport = 'nba', leagueRosters, gmProfile }) {
  if (!leagueRosters?.teams?.length) throw new Error('leagueRosters required')

  const userTeam = leagueRosters.teams.find(t => t.isUser)
  if (!userTeam) throw new Error('User team not found in rosters')

  const numTeams = leagueRosters.teams.length
  const rank = userTeam.rank ?? null

  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', getPlayerFile(sport)), 'utf8'))
  const playerByName = {}
  for (const p of players) playerByName[normalizeName(p.name)] = p

  const sportConfig = getSportConfig(sport)
  const allTeamTotals = {}
  for (const team of leagueRosters.teams) {
    const resolvedPlayers = team.roster.map(r => playerByName[normalizeName(r.name)])
    allTeamTotals[team.teamKey] = aggregateCategoryTotals(resolvedPlayers, sportConfig.categories, sportConfig.percentageCategories)
  }
  const winRates = getCategoryWinRates({
    teamKey: userTeam.teamKey,
    allTeamTotals,
    categories: sportConfig.categories,
    lowerIsBetter: sportConfig.lowerIsBetter,
  })
  const rankedCategories = sportConfig.categories
    .map(c => ({ label: c.label, rate: winRates[c.id]?.rate }))
    .filter(c => c.rate != null)
    .sort((a, b) => b.rate - a.rate)
  const strengthLine = rankedCategories.length
    ? `Strongest: ${rankedCategories.slice(0, 3).map(c => `${c.label} (beat ${Math.round(c.rate * 100)}% of the league)`).join(', ')}`
    : 'Strongest: not enough data to tell'
  const weaknessLine = rankedCategories.length
    ? `Weakest: ${rankedCategories.slice(-3).reverse().map(c => `${c.label} (beat ${Math.round(c.rate * 100)}% of the league)`).join(', ')}`
    : 'Weakest: not enough data to tell'

  const rosterLines = userTeam.roster.map(r => formatRosterLine(r, playerByName[normalizeName(r.name)], sport))
  const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'
  const gmLine = gmProfile?.injuryTolerance
    ? `\nGM Profile: injury tolerance = ${gmProfile.injuryTolerance}, strategy = ${gmProfile.draftStrategy ?? 'balanced'}.`
    : ''

  const systemPrompt = `You are Billy Beane wrapping up a ${sportLabel} GM's season with a short, honest recap.

Cover: how the season actually went given the final record and rank; the real strongest and weakest categories (use the deterministic win-rate data given below — don't guess or recompute); and one concrete thing to prioritize differently next draft/season given how this roster performed. Be direct and specific (Beane voice) — this is a season postmortem, not a pep talk. Congratulate genuine success and call out real weaknesses plainly.

Reply ONLY with raw JSON — no markdown, no extra text:
{"headline":"1 short sentence capturing the season","summary":"2-3 sentences on how the season played out","strengths":"1 sentence on what actually worked","weaknesses":"1 sentence on what held the team back","lookAhead":"1 sentence, concrete tip for next season"}`

  const userPrompt = `${sportLabel} league · final standing: #${rank ?? '?'} of ${numTeams}
Final record: W${userTeam.wins ?? 0}/L${userTeam.losses ?? 0}${userTeam.ties ? `/T${userTeam.ties}` : ''}${gmLine}

MY TEAM (${userTeam.teamName}) FINAL CATEGORY PERFORMANCE (deterministic, vs. rest of league):
${strengthLine}
${weaknessLine}

FINAL ROSTER:
${rosterLines.join('\n')}

Give me the season recap.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: [{ type: 'text', text: systemPrompt }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = message.content[0]?.text ?? ''
  const parsed = extractJSON(text)

  return { ...parsed, rank, numTeams, wins: userTeam.wins ?? 0, losses: userTeam.losses ?? 0, ties: userTeam.ties ?? 0, teamName: userTeam.teamName }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sport = 'nba', leagueRosters, gmProfile } = req.body

  try {
    const recap = await getSeasonRecap({ sport, leagueRosters, gmProfile })
    res.json(recap)
  } catch (err) {
    console.error('[season-recap]', err)
    const clientErrors = ['leagueRosters required', 'User team not found in rosters']
    res.status(clientErrors.includes(err.message) ? 400 : 500).json({ error: err.message })
  }
}
