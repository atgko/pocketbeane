import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { getSportConfig, getPlayerFile, getScheduleFile, hasScheduleSupport } from '@/config/sports'
import { formatStats, formatCurrentSeasonLine, CURRENT_SEASON_REASONING_INSTRUCTION } from '@/ai/seasonStats'
import { normalizeName } from '@/utils/playerName'
import { getTeamGamesInRange, hasBackToBack, getWeekRange } from '@/utils/schedule'

const client = new Anthropic()

// Same JSON-extraction helper as waiver-advice.js/matchup-advice.js — a 3rd
// copy. Worth extracting to a shared module if a 4th advisor needs it.
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
  console.error('[startsit-advice] unparseable model response:', text)
  throw new Error('Malformed JSON in model response')
}

export async function getStartSitAdvice({ sport = 'nba', leagueRosters, rosterConfig, weekStart, weekEnd, gmProfile }) {
  if (!hasScheduleSupport(sport)) {
    throw new Error(`Start/Sit Advisor isn't available for ${sport} yet — no schedule data configured.`)
  }
  if (!leagueRosters?.teams) throw new Error('leagueRosters required')

  const userTeam = leagueRosters.teams.find(t => t.isUser)
  if (!userTeam) throw new Error('User team not found in rosters')

  const scheduleFilePath = path.join(process.cwd(), 'src/data', getScheduleFile(sport))
  let schedule
  try {
    schedule = JSON.parse(fs.readFileSync(scheduleFilePath, 'utf8'))
  } catch (err) {
    throw new Error(`Start/Sit Advisor isn't available for ${sport} yet — no schedule data configured.`)
  }

  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', getPlayerFile(sport)), 'utf8'))
  const playerById = {}
  const playerByName = {}
  for (const p of players) {
    playerById[p.id] = p
    playerByName[normalizeName(p.name)] = p
  }

  const { start, end } = weekStart && weekEnd
    ? { start: weekStart, end: weekEnd }
    : getWeekRange(new Date().toISOString().slice(0, 10))

  const sportConfig = getSportConfig(sport)
  const backToBackRelevant = sportConfig.backToBackRelevant ?? false

  let totalGamesThisWeek = 0
  const enrichedRoster = userTeam.roster.map(r => {
    const p = (r.playerId && playerById[r.playerId]) || playerByName[normalizeName(r.name)]
    if (!p) return { name: r.name, positions: [], line: `${r.name}(${r.positions ?? '?'}): no player data` }

    const gameDates = p.team ? getTeamGamesInRange(schedule, p.team, start, end) : []
    totalGamesThisWeek += gameDates.length
    const b2bTag = backToBackRelevant && hasBackToBack(gameDates) ? ' B2B' : ''

    const injuryStatus = p.current_season?.injury_status ?? p.injury_status
    const injuryNote = p.current_season?.injury_note ?? p.injury_notes
    const injuryTag = injuryStatus && injuryStatus !== 'healthy'
      ? ` [${injuryStatus}${injuryNote ? ': ' + injuryNote : ''}]`
      : ''

    const line = `${p.name}(${p.yahoo_positions?.join('/') ?? r.positions ?? '?'}) [${p.team ?? '?'}] games-this-week=${gameDates.length}${b2bTag}${injuryTag}: ${formatStats(p, sport)}${formatCurrentSeasonLine(p, sport)}`
    return { name: p.name, positions: p.yahoo_positions ?? [], line }
  })
  const rosterLines = enrichedRoster.map(ep => ep.line)

  if (totalGamesThisWeek === 0) {
    return {
      week: { start, end },
      headline: 'No games scheduled for your roster this week — nothing to set.',
      startingLineup: [],
      benchNotes: [],
    }
  }

  const effectiveRosterConfig = { ...sportConfig.defaultRosterConfig, ...rosterConfig }
  const startingSlots = sportConfig.slotOrder.filter(s => s.type !== 'BN')
  const slotSummaryParts = startingSlots.map(s => {
    const count = effectiveRosterConfig[s.configKey] ?? s.default
    return `${s.type} x${count}`
  })
  const totalStartingSlots = startingSlots.reduce((sum, s) => sum + (effectiveRosterConfig[s.configKey] ?? s.default), 0)
  const benchCount = effectiveRosterConfig.bnSlots ?? sportConfig.defaultRosterConfig.bnSlots
  const slotSummaryLine = `Starting slots: ${slotSummaryParts.join(', ')}  (${totalStartingSlots} total, ${benchCount} bench)`

  // Position eligibility is a deterministic set-membership check — computing it
  // here and handing the model a pre-filtered menu per slot is far more
  // reliable than asking the model to cross-reference each player's positions
  // against slotEligibility itself (verified: without this, the model
  // regularly placed players in slots they weren't eligible for, e.g. a
  // pitcher-only player into an outfield slot).
  function isEligibleForSlot(positions, slotType) {
    if (positions.includes(slotType)) return true
    const flexPositions = sportConfig.slotEligibility?.[slotType]
    return flexPositions ? flexPositions.some(pos => positions.includes(pos)) : false
  }
  const slotTypes = [...new Set(startingSlots.map(s => s.type))]
  const eligibilityLines = slotTypes.map(type => {
    const names = enrichedRoster
      .filter(ep => isEligibleForSlot(ep.positions, type))
      .map(ep => ep.name)
    return `${type}: ${names.length ? names.join(', ') : '(no rostered player is eligible for this slot)'}`
  })
  const eligibilityLegend = eligibilityLines.join('\n')

  const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'
  const gmLine = gmProfile?.injuryTolerance
    ? `\nGM Profile: injury tolerance = ${gmProfile.injuryTolerance}.`
    : ''
  const mlbCaveat = sport === 'mlb'
    ? '\n\nNote: pitcher probable starts aren\'t tracked yet — "games-this-week" for pitchers is an approximate team-schedule proxy, not a confirmed start count. Treat pitcher recommendations as lower-confidence than hitter recommendations, and say so when it matters.'
    : ''

  const systemPrompt = `You are Billy Beane setting a ${sportLabel} lineup for the week of ${start} to ${end}.

Given my full roster (starters and bench — I don't have a saved lineup for you to start from, decide it fresh) and the roster's slot structure below, build the optimal starting lineup for this week. Weigh, in order: (1) games this week — more games is more category production; (2) injury status — day-to-day/out players should not occupy a starting slot over a healthy alternative unless no eligible alternative exists; (3) recent form — CURRENT season trend vs prior season baseline; (4) back-to-backs are a marginal positive (two games close together), not a reason to sit a player.

Position eligibility for each slot has ALREADY been computed for you in "ELIGIBLE PLAYERS BY SLOT" below — for any given slot, you must choose only from the players listed for that exact slot type. Do not use a player who isn't listed for that slot, even if you believe they qualify. Each rostered player may fill AT MOST ONE slot total — never list the same player twice across the lineup, even if they're eligible for multiple open slots. If a slot has no eligible rostered player, omit that slot entry entirely rather than guessing.

${slotSummaryLine}

ELIGIBLE PLAYERS BY SLOT:
${eligibilityLegend}

${CURRENT_SEASON_REASONING_INSTRUCTION}${mlbCaveat}

Return exactly one lineup entry per starting slot listed above (repeat slot types for multi-count slots, e.g. two UTIL entries), each filled by the single best eligible rostered player for that slot this week. Then list up to 3 notable bench calls — rostered players NOT in the starting lineup whose case is worth flagging (e.g. a hot bench player just missing the cut, or a would-be starter you're sitting for injury/schedule reasons).

Reply ONLY with raw JSON — no markdown, no extra text:
{"headline":"1 sentence framing the week's biggest lineup lever","startingLineup":[{"slot":"PG","player":"Player Name","gamesThisWeek":4,"backToBack":false,"reason":"1-2 sentences Beane voice"}],"benchNotes":[{"player":"Player Name","reason":"1-2 sentences Beane voice"}]}`

  const userPrompt = `Week of ${start} to ${end} · ${sportLabel}${gmLine}

MY ROSTER (${userTeam.teamName}):
${rosterLines.join('\n')}

Set my lineup for the week.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: [{ type: 'text', text: systemPrompt }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = message.content[0]?.text ?? ''
  const parsed = extractJSON(text)

  // The eligibility legend above cuts most violations, but the model still
  // occasionally ignores it (verified in testing — e.g. slotting a
  // pitcher-only player into UTIL). Position eligibility and no-duplicates
  // are both deterministic checks we've already computed, so validate the
  // model's output against them rather than trust it — drop invalid entries
  // rather than serve a lineup with a player in a slot they can't play.
  // Deliberately not auto-backfilling a dropped slot with a fallback pick:
  // that's a second ranking algorithm to get right; an honestly-short
  // lineup is preferable to a silently-wrong one.
  const seenPlayers = new Set()
  const validatedLineup = (parsed.startingLineup ?? []).filter(entry => {
    const rosterPlayer = enrichedRoster.find(ep => ep.name === entry.player)
    if (!rosterPlayer) {
      console.warn(`[startsit-advice] dropped lineup entry — "${entry.player}" not found on roster`)
      return false
    }
    if (!isEligibleForSlot(rosterPlayer.positions, entry.slot)) {
      console.warn(`[startsit-advice] dropped lineup entry — "${entry.player}" isn't eligible for ${entry.slot}`)
      return false
    }
    if (seenPlayers.has(entry.player)) {
      console.warn(`[startsit-advice] dropped duplicate lineup entry — "${entry.player}" already used`)
      return false
    }
    seenPlayers.add(entry.player)
    return true
  })

  return { week: { start, end }, ...parsed, startingLineup: validatedLineup }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sport = 'nba', leagueRosters, rosterConfig, weekStart, weekEnd, gmProfile } = req.body

  try {
    const advice = await getStartSitAdvice({ sport, leagueRosters, rosterConfig, weekStart, weekEnd, gmProfile })
    res.json(advice)
  } catch (err) {
    console.error('[startsit-advice]', err)
    const isClientError =
      ['leagueRosters required', 'User team not found in rosters'].includes(err.message) ||
      err.message.includes('no schedule data configured')
    res.status(isClientError ? 400 : 500).json({ error: err.message })
  }
}
