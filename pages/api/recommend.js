import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SESSION_LIMIT = 50
const sessionCounts = new Map()

const GM_INJURY_LABELS = {
  conservative: 'Conservative — avoids injury-prone players, docks their ranking significantly',
  moderate:     'Moderate — flags injury risk but weighs it against upside',
  aggressive:   'Aggressive — treats injury history as a market discount and exploits it',
}

const GM_CATEGORY_LABELS = {
  compete_all_9:   'Compete in all 9 — wants balanced coverage, no deliberate weaknesses',
  punt_categories: 'Punts 1-2 categories — prefers dominating 7 over spreading thin. Do NOT flag weakness in punted categories as a problem — treat it as intentional.',
  read_the_draft:  "Reads the draft — no predetermined category plan, decides based on what's available",
}

const GM_STRATEGY_LABELS = {
  beane:            'Beane Mode — ADP value-first, exploits market mispricings, fills categories in the middle rounds',
  balanced:         'Balanced — even spread across all categories and positions from round one',
  'stars-and-scrubs': 'Stars and scrubs — weight rounds 1-4 toward the best player available, fill depth late',
  punt:             'Punt strategy — deliberately concedes 1-2 categories to dominate the rest',
}

function buildProfileBlock(gmProfile) {
  if (!gmProfile?.injuryTolerance) {
    return 'GM PHILOSOPHY PROFILE: Not set. Apply balanced default recommendations.'
  }
  return `GM PHILOSOPHY PROFILE FOR THIS USER:
- Injury tolerance: ${GM_INJURY_LABELS[gmProfile.injuryTolerance] ?? gmProfile.injuryTolerance}
- Category strategy: ${GM_CATEGORY_LABELS[gmProfile.categoryStrategy] ?? gmProfile.categoryStrategy}
- Draft strategy: ${GM_STRATEGY_LABELS[gmProfile.draftStrategy] ?? gmProfile.draftStrategy}

Weight all recommendations according to this profile.`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sessionId = req.headers['x-session-id']
  if (sessionId) {
    const count = sessionCounts.get(sessionId) ?? 0
    if (count >= SESSION_LIMIT) {
      console.warn('[recommend] rate limit hit', sessionId)
      return res.status(429).json({ error: `Rate limit exceeded. Max ${SESSION_LIMIT} recommendations per session.` })
    }
    sessionCounts.set(sessionId, count + 1)
  }

  const { mode = 'auto', leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates, philosophy = {}, snakeContext = {}, auctionContext = {}, bidTarget = null, gmProfile = null } = req.body

  // Bold prediction — plain text response, bypasses extractJSON
  if (mode === 'bold_prediction') {
    const { rosterPlayers = [], archetypeName = '', topCategories = [], sport = 'nba' } = req.body
    const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'
    try {
      const predictionMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: [{
          type: 'text',
          text: `You are Billy Beane making a bold prediction about a ${sportLabel} team. Generate exactly one sentence under 25 words. Be specific, name a player if possible, state it as fact — no hedging, no "might", no "could". Return only the sentence, nothing else.`,
        }],
        messages: [{
          role: 'user',
          content: `Archetype: ${archetypeName}\nTop categories: ${topCategories.join(', ') || 'none'}\nRoster: ${rosterPlayers.slice(0, 8).join(', ') || 'unknown'}\n\nGenerate one bold prediction about how this team performs this season.`,
        }],
      })
      const prediction = predictionMsg.content[0]?.text?.trim() ?? ''
      return res.json({ boldPrediction: prediction })
    } catch (err) {
      console.error('[recommend:bold_prediction]', err)
      return res.status(500).json({ error: err.message })
    }
  }

  if (!leagueConfig || !boardState) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const { system, user, maxTokens } = buildMessages(
      mode, leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates, philosophy, snakeContext, auctionContext, bidTarget
    )

    system.push({ type: 'text', text: buildProfileBlock(gmProfile) })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const text = message.content[0]?.text ?? ''
    const parsed = extractJSON(text)
    res.json({ mode, ...parsed })
  } catch (err) {
    console.error('[recommend]', err)
    res.status(500).json({ error: err.message || 'Failed to get recommendation' })
  }
}

// Handles: raw JSON, markdown fences (```json), JSON with surrounding text.
// Falls back through each strategy before giving up.
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

function fmt(val, isPct) {
  if (val == null) return '—'
  return isPct ? val.toFixed(3) : val.toFixed(1)
}

function buildMessages(mode, leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates, philosophy, snakeContext, auctionContext, bidTarget) {
  if (mode === 'post-pick')        return buildPostPickMessages(leagueConfig, boardState, categoryGaps, topCandidates, philosophy, snakeContext)
  if (mode === 'complete')         return buildCompleteMessages(leagueConfig, boardState, categoryGaps)
  if (mode === 'advice')           return buildAdviceMessages(leagueConfig, boardState, categoryGaps, topCandidates)
  if (mode === 'nomination')       return buildNominationMessages(leagueConfig, boardState, categoryGaps, topCandidates, philosophy, auctionContext)
  if (mode === 'bid-advice')       return buildBidAdviceMessages(leagueConfig, boardState, categoryGaps, philosophy, auctionContext, bidTarget)
  if (mode === 'auction-watching') return buildAuctionWatchingMessages(leagueConfig, boardState, categoryGaps, topCandidates, auctionContext)
  return buildAutoMessages(leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates, philosophy, snakeContext)
}

// ─── Candidate stat formatter — sport-aware ──────────────────────────────────

function formatCandidateStats(player, sport) {
  const s = player.prior_season
  if (sport === 'mlb') {
    return `r=${fmt(s?.r,false)} hr=${fmt(s?.hr,false)} rbi=${fmt(s?.rbi,false)} sb=${fmt(s?.sb,false)} avg=${fmt(s?.avg,true)} w=${fmt(s?.w,false)} sv=${fmt(s?.sv,false)} k=${fmt(s?.k,false)} era=${fmt(s?.era,false)} whip=${fmt(s?.whip,false)}`
  }
  return `pts=${fmt(s?.pts,false)} reb=${fmt(s?.reb,false)} ast=${fmt(s?.ast,false)} stl=${fmt(s?.stl,false)} blk=${fmt(s?.blk,false)} 3pm=${fmt(s?.three_pm,false)} fg%=${fmt(s?.fg_pct,true)} ft%=${fmt(s?.ft_pct,true)} to=${fmt(s?.to,false)}`
}

function defaultScoringLine(sport) {
  if (sport === 'mlb') return 'Scoring: R, HR, RBI, SB, AVG (hitting) + W, SV, K, ERA↓, WHIP↓ (pitching)'
  return 'Scoring: PTS, REB, AST, STL, BLK, TO↓, FG%, FT%, 3PM'
}

// ─── Auto mode — fires on user's pick turn ───────────────────────────────────

const AUTO_SYSTEM = `You are Billy Beane — data-obsessed, unsentimental, decisive. You are the GM making a pick RIGHT NOW in a Yahoo fantasy sports snake draft.

You will receive a positional depth snapshot showing how many quality options survive at each position by your next pick. Use this to assess whether a position the team needs is genuinely drying up — not just losing one player, but losing the entire viable pool.

URGENCY rules (strict):
- Only prepend exactly 'URGENCY: ' to a reason when: (1) a position the team currently needs shows COLLAPSE or EMPTY at next pick, AND (2) skipping that position this round means the viable pool is effectively gone.
- Do NOT use URGENCY: when the position is STABLE or THIN — those positions still have options.
- Do NOT use URGENCY: on a pick just because an individual star will be gone. The question is whether the position's depth collapses.
- Most picks should have no URGENCY. Reserve it for genuine inflection points.

Reply ONLY with raw JSON — no markdown, no explanation, no extra text:
{"picks":[{"id":"player-id","name":"Name","reason":"Pick 1 gets 3-4 sentences: open with the specific stats and categories this player addresses, then weave in the strategic context — what the snake window and positional depth mean for this decision, and how this pick sets up the team. One cohesive paragraph, Beane voice. Prepend 'URGENCY: ' only per the rules above."},{"id":"...","name":"...","reason":"1-2 sentences. Why this alternative, what it offers differently."},{"id":"...","name":"...","reason":"1-2 sentences. Why this alternative, what it offers differently."}]}`

const STRATEGY_LABELS = {
  'beane':            'Beane Mode (ADP value-first)',
  'balanced':         'Balanced (even category spread)',
  'stars-and-scrubs': 'Stars & Scrubs (elite early, volume late)',
  'punt':             'Punt Strategy',
}

function buildAutoMessages(leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates, philosophy = {}, snakeContext = {}) {
  const { numTeams, draftPosition, scoringFormat, statCategories, rosterPositions, sport = 'nba' } = leagueConfig
  const { userPicksWithData, totalPicks, currentRound, userPicksRemaining } = boardState
  const { strategy = 'beane', puntCategories = [], injuryTolerance = 'moderate' } = philosophy

  const system = [{ type: 'text', text: AUTO_SYSTEM, cache_control: { type: 'ephemeral' } }]

  const roster = userPicksWithData.length > 0
    ? userPicksWithData.map(p => `${p.name}(${p.yahoo_positions.join('/')})`).join(', ')
    : 'Empty — first pick'

  const weakCats   = categoryGaps.filter(g => g.grade === 'weak'   || g.grade === 'missing').map(g => g.label).join(', ')
  const strongCats = categoryGaps.filter(g => g.grade === 'strong').map(g => g.label).join(', ')

  const catStatus = categoryGaps.map(g => {
    const isPct = g.id.includes('pct')
    return `${g.label}:${g.current != null ? fmt(g.current, isPct) : '—'}/${fmt(g.benchmark, isPct)}[${g.grade}]`
  }).join(' ')

  const candidates = (topCandidates ?? []).slice(0, 8).map(c => {
    const p = c.player
    const injuryTag = p.injury_risk ? ` ⚠️injury` : ''
    return `${p.id}|${p.name}(${p.yahoo_positions.join('/')},ADP${p.adp.toFixed(1)}${injuryTag}):${formatCandidateStats(p, sport)}`
  }).join('\n')

  const alertLine = scarcityAlerts?.length > 0 ? `\nSCARCITY: ${scarcityAlerts.join(' ')}` : ''

  const strategyLabel = STRATEGY_LABELS[strategy] ?? strategy
  const puntLine = puntCategories.length > 0 ? ` Punting: ${puntCategories.join(', ')}.` : ''
  const strategyLine = `\nStrategy: ${strategyLabel}.${puntLine} Injury tolerance: ${injuryTolerance}.`

  const { picksUntilNext, nextPickNum, projectedGone = [], positionalDepth = [] } = snakeContext

  const depthLines = positionalDepth.length > 0
    ? positionalDepth.map(d => `${d.pos}: ${d.nowCount} now → ${d.laterCount} at next pick [${d.severity}]`).join(', ')
    : ''

  const snakeLine = picksUntilNext > 0 && nextPickNum
    ? `\nSnake window: ${picksUntilNext} opponent pick${picksUntilNext === 1 ? '' : 's'} before next turn (#${nextPickNum}).${depthLines ? `\nPositional depth (quality options now → at pick #${nextPickNum}): ${depthLines}.` : ''}`
    : picksUntilNext === 0 && nextPickNum
    ? `\nSnake window: consecutive picks — next turn is #${nextPickNum}, board essentially unchanged.`
    : ''

  const scoringLine = statCategories?.length
    ? `Scoring: ${statCategories.map(c => c.higherIsBetter ? c.name : `${c.name}↓`).join(', ')}`
    : defaultScoringLine(sport)

  const starterSlots = rosterPositions?.filter(p => p.isStarter)
  const slotsLine = starterSlots?.length
    ? `Roster: ${starterSlots.map(p => `${p.position}×${p.count}`).join(' ')}`
    : null

  const contextLines = [scoringLine, slotsLine].filter(Boolean).join('\n')

  const user = `${numTeams} teams, pick position ${draftPosition} (${scoringFormat}).
${contextLines}
Round ${currentRound}, pick #${totalPicks + 1}. ${userPicksRemaining} roster spots left.
My team: ${roster}
Category status (current/benchmark[grade]): ${catStatus}
Weak: ${weakCats || 'none'}. Strong: ${strongCats || 'none'}.${alertLine}${strategyLine}${snakeLine}

Top available by fit (use these exact ids in your response):
${candidates}`

  return { system, user, maxTokens: 800 }
}

// ─── Post-pick mode — fires after user picks, sets up next turn ──────────────

const POST_PICK_SYSTEM = `You are Billy Beane. Your GM just locked in their pick. Now brief them on what to target when their next turn comes around in this fantasy sports snake draft.

Give 2-3 targets to watch. Pick 1 gets 3-4 sentences: open by acknowledging what the pick just addressed for the team, then pivot to what the team needs next and why this target fits — specific categories, whether they'll survive to the next pick based on the snake window, and how they complete the roster being built. Picks 2 and 3 are 1-2 sentences each as contingency options. Beane voice throughout.

Reply ONLY with raw JSON — no markdown, no explanation, no extra text:
{"picks":[{"id":"player-id","name":"Name","reason":"..."},{"id":"...","name":"...","reason":"..."},{"id":"...","name":"...","reason":"..."}]}`

function buildPostPickMessages(leagueConfig, boardState, categoryGaps, topCandidates, philosophy = {}, snakeContext = {}) {
  const { numTeams, draftPosition, scoringFormat, statCategories, rosterPositions, sport = 'nba' } = leagueConfig
  const { userPicksWithData, totalPicks, currentRound, userPicksRemaining } = boardState
  const { strategy = 'beane', puntCategories = [], injuryTolerance = 'moderate' } = philosophy

  const system = [{ type: 'text', text: POST_PICK_SYSTEM, cache_control: { type: 'ephemeral' } }]

  const lastPick = userPicksWithData[userPicksWithData.length - 1]
  const lastPickLine = lastPick
    ? `Just drafted: ${lastPick.name}(${lastPick.yahoo_positions.join('/')}).`
    : ''

  const roster = userPicksWithData.length > 0
    ? userPicksWithData.map(p => `${p.name}(${p.yahoo_positions.join('/')})`).join(', ')
    : 'Empty'

  const weakCats  = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing').map(g => g.label).join(', ')
  const strongCats = categoryGaps.filter(g => g.grade === 'strong').map(g => g.label).join(', ')

  const catStatus = categoryGaps.map(g => {
    const isPct = g.id.includes('pct')
    return `${g.label}:${g.current != null ? fmt(g.current, isPct) : '—'}/${fmt(g.benchmark, isPct)}[${g.grade}]`
  }).join(' ')

  const candidates = (topCandidates ?? []).slice(0, 8).map(c => {
    const p = c.player
    const injuryTag = p.injury_risk ? ` ⚠️injury` : ''
    return `${p.id}|${p.name}(${p.yahoo_positions.join('/')},ADP${p.adp.toFixed(1)}${injuryTag}):${formatCandidateStats(p, sport)}`
  }).join('\n')

  const strategyLabel = STRATEGY_LABELS[strategy] ?? strategy
  const puntLine = puntCategories.length > 0 ? ` Punting: ${puntCategories.join(', ')}.` : ''
  const strategyLine = `\nStrategy: ${strategyLabel}.${puntLine} Injury tolerance: ${injuryTolerance}.`

  const { picksUntilNext, nextPickNum, positionalDepth = [] } = snakeContext
  const depthLines = positionalDepth.length > 0
    ? positionalDepth.map(d => `${d.pos}: ${d.nowCount} now → ${d.laterCount} at next pick [${d.severity}]`).join(', ')
    : ''
  const snakeLine = picksUntilNext > 0 && nextPickNum
    ? `\nSnake window: ${picksUntilNext} opponent pick${picksUntilNext === 1 ? '' : 's'} before next turn (#${nextPickNum}).${depthLines ? `\nPositional depth (quality options now → at pick #${nextPickNum}): ${depthLines}.` : ''}`
    : picksUntilNext === 0 && nextPickNum
    ? `\nSnake window: consecutive picks — next turn is #${nextPickNum}, board essentially unchanged.`
    : ''

  const scoringLine = statCategories?.length
    ? `Scoring: ${statCategories.map(c => c.higherIsBetter ? c.name : `${c.name}↓`).join(', ')}`
    : defaultScoringLine(sport)
  const starterSlots = rosterPositions?.filter(p => p.isStarter)
  const slotsLine = starterSlots?.length
    ? `Roster: ${starterSlots.map(p => `${p.position}×${p.count}`).join(' ')}`
    : null
  const contextLines = [scoringLine, slotsLine].filter(Boolean).join('\n')

  const user = `${numTeams} teams, pick position ${draftPosition} (${scoringFormat}).
${contextLines}
${lastPickLine}
My team now: ${roster}
Category status: ${catStatus}
Weak: ${weakCats || 'none'}. Strong: ${strongCats || 'none'}.${strategyLine}${snakeLine}

Watch list — likely still available at next pick (use these exact ids):
${candidates}`

  return { system, user, maxTokens: 700 }
}

// ─── Advice mode — fires during opponent turns ────────────────────────────────

const ADVICE_SYSTEM = `You are Billy Beane watching opponents draft. Give ONE casual, confident 1-2 sentence take. No intro, no sign-off, no "as Billy Beane".

Style examples:
- "I'd keep an eye on Barnes — threes and boards, exactly what we need. He won't last much longer."
- "The market's sleeping on rebounders right now. If one falls to us, that's our pick."
- "Let them fight over point guards. We're waiting for the big who fixes our FG%."

Reply ONLY with raw JSON — no markdown, no explanation: {"briefing":"your 1-2 sentence casual take"}`

function buildAdviceMessages(leagueConfig, boardState, categoryGaps, topCandidates) {
  const { numTeams } = leagueConfig
  const { userPicksWithData, totalPicks, currentRound } = boardState

  const system = [{ type: 'text', text: ADVICE_SYSTEM, cache_control: { type: 'ephemeral' } }]

  const opponentPicksLeft = numTeams - (totalPicks % numTeams) - 1
  const weakCats  = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing').map(g => g.label).join(', ')
  const watchList = (topCandidates ?? []).slice(0, 3).map(c => `${c.player.name}(ADP${c.player.adp.toFixed(1)})`).join(', ')
  const roster    = userPicksWithData.length > 0
    ? userPicksWithData.map(p => p.name).join(', ')
    : 'no picks yet'

  const user = `Round ${currentRound}, ${opponentPicksLeft} opponent picks remaining.
My team: ${roster}. Need: ${weakCats || 'balanced'}. Watching: ${watchList}.`

  return { system, user, maxTokens: 300 }
}

// ─── Complete mode — fires after draft finishes ───────────────────────────────

const COMPLETE_SYSTEM = `You are Billy Beane presenting your completed fantasy team to ownership. The draft is done.

Write your GM's season report. Be specific and direct. No filler.

Reply ONLY with raw JSON — no markdown, no explanation:
{"outlook":"3-4 sentence GM narrative — what the team is built around, the key vulnerability, and one bold specific prediction","strengths":["2-3 category labels that are genuinely strong"],"vulnerabilities":["1-3 category labels that are weak or at risk"],"riskNote":"one sentence about injury-risk players on the roster, or null if no injury risks"}`

function buildCompleteMessages(leagueConfig, boardState, categoryGaps) {
  const { name, numTeams } = leagueConfig
  const { userPicksWithData } = boardState

  const system = [{ type: 'text', text: COMPLETE_SYSTEM, cache_control: { type: 'ephemeral' } }]

  const roster  = userPicksWithData.map(p => {
    const injuryTag = p.injury_risk ? ` [INJURY RISK: ${p.injury_notes ?? 'history'}]` : ''
    return `${p.name}(${p.yahoo_positions.join('/')}${injuryTag})`
  }).join(', ')
  const grades  = categoryGaps.map(g => `${g.label}[${g.grade}]`).join(' ')
  const strong  = categoryGaps.filter(g => g.grade === 'strong').map(g => g.label).join(', ')
  const weak    = categoryGaps.filter(g => g.grade === 'weak').map(g => g.label).join(', ')

  const user = `League: ${name} (${numTeams} teams)
Final roster: ${roster}
Category grades: ${grades}
Strengths: ${strong || 'none'}. Vulnerabilities: ${weak || 'none'}.`

  return { system, user, maxTokens: 800 }
}

// ─── Auction: nomination mode — fires on user's nomination turn ───────────────

const AUCTION_STRATEGY_LABELS = {
  'beane':            'Value Hunt (exploit market inefficiencies)',
  'balanced':         'Balanced ($18–40 tier, no $1 gambles)',
  'stars-and-scrubs': 'Stars & Scrubs (2–3 studs, fill with $1–5)',
  'budget-control':   'Budget Control (hold reserves, dominate late)',
}

const NOMINATION_SYSTEM = `You are Billy Beane — data-obsessed, unsentimental, decisive. It's your nomination turn in a Yahoo fantasy sports auction draft.

Two levers: nominate a player you want (bid on your own terms) or nominate a player the room covets (drain their budgets before you spend yours). The right call depends on your strategy and budget position.

Give 3 nomination candidates ranked by strategic value. Pick 1 gets 3-4 sentences: open with what this player fixes for the team and their projected value, then explain the nomination angle — are you going in to win this one or using them to bleed the room dry? Reference the budget situation. Picks 2 and 3 are 1-2 sentences each as alternatives. Beane voice throughout.

Reply ONLY with raw JSON — no markdown, no explanation, no extra text:
{"picks":[{"id":"player-id","name":"Name","reason":"..."},{"id":"...","name":"...","reason":"..."},{"id":"...","name":"...","reason":"..."}]}`

function buildNominationMessages(leagueConfig, boardState, categoryGaps, topCandidates, philosophy = {}, auctionContext = {}) {
  const { numTeams, scoringFormat, statCategories, rosterPositions, sport = 'nba' } = leagueConfig
  const { userPicksWithData, userPicksRemaining } = boardState
  const { strategy = 'beane', puntCategories = [], injuryTolerance = 'moderate' } = philosophy
  const { nominationNumber, budgetRemaining, spendableBudget, avgCostPerRemainingSpot } = auctionContext

  const system = [{ type: 'text', text: NOMINATION_SYSTEM, cache_control: { type: 'ephemeral' } }]

  const roster = userPicksWithData.length > 0
    ? userPicksWithData.map(p => `${p.name}(${p.yahoo_positions.join('/')},$${p.price ?? '?'})`).join(', ')
    : 'Empty — first nomination'

  const weakCats  = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing').map(g => g.label).join(', ')
  const strongCats = categoryGaps.filter(g => g.grade === 'strong').map(g => g.label).join(', ')

  const catStatus = categoryGaps.map(g => {
    const isPct = g.id.includes('pct')
    return `${g.label}:${g.current != null ? fmt(g.current, isPct) : '—'}/${fmt(g.benchmark, isPct)}[${g.grade}]`
  }).join(' ')

  const candidates = (topCandidates ?? []).slice(0, 8).map(c => {
    const p = c.player
    const injuryTag = p.injury_risk ? ` ⚠️injury` : ''
    return `${p.id}|${p.name}(${p.yahoo_positions.join('/')},$${p.auction_value ?? '?'}${injuryTag}):${formatCandidateStats(p, sport)}`
  }).join('\n')

  const strategyLabel = AUCTION_STRATEGY_LABELS[strategy] ?? strategy
  const puntLine = puntCategories.length > 0 ? ` Punting: ${puntCategories.join(', ')}.` : ''
  const strategyLine = `\nStrategy: ${strategyLabel}.${puntLine} Injury tolerance: ${injuryTolerance}.`

  const scoringLine = statCategories?.length
    ? `Scoring: ${statCategories.map(c => c.higherIsBetter ? c.name : `${c.name}↓`).join(', ')}`
    : defaultScoringLine(sport)
  const starterSlots = rosterPositions?.filter(p => p.isStarter)
  const slotsLine = starterSlots?.length
    ? `Roster: ${starterSlots.map(p => `${p.position}×${p.count}`).join(' ')}`
    : null
  const contextLines = [scoringLine, slotsLine].filter(Boolean).join('\n')

  const avgStr = avgCostPerRemainingSpot != null ? `$${Math.round(avgCostPerRemainingSpot)} avg/spot` : null
  const budgetLine = [
    budgetRemaining != null ? `$${budgetRemaining} remaining` : null,
    spendableBudget != null ? `$${spendableBudget} max single bid` : null,
    avgStr,
    `${userPicksRemaining} spots left`,
  ].filter(Boolean).join(' · ')

  const user = `${numTeams} teams, nomination #${nominationNumber ?? '?'} (${scoringFormat}).
${contextLines}
Budget: ${budgetLine}.
My team: ${roster}
Category status (current/benchmark[grade]): ${catStatus}
Weak: ${weakCats || 'none'}. Strong: ${strongCats || 'none'}.${strategyLine}

Top available by fit (use these exact ids):
${candidates}`

  return { system, user, maxTokens: 800 }
}

// ─── Auction: bid-advice mode — on-demand ceiling for an active nomination ────

const BID_ADVICE_SYSTEM = `You are Billy Beane. A player just hit the auction block. Give a decisive bid ceiling — a number and a verdict. No hedging.

2-3 sentences: state your ceiling, reference the player's projected value and what they fix for the team, and judge where the current bid sits relative to the walk-away point.

verdict must be exactly one of:
- "buy" — current bid is good value, go to your ceiling
- "stretch" — current bid exceeds fair value but player is critical, ceiling is your hard stop
- "pass" — current bid already exceeds ceiling, walk away now

Reply ONLY with raw JSON — no markdown, no explanation, no extra text:
{"ceiling":42,"verdict":"buy","reason":"2-3 sentences"}`

function buildBidAdviceMessages(leagueConfig, boardState, categoryGaps, philosophy = {}, auctionContext = {}, bidTarget = null) {
  const { numTeams, scoringFormat, sport = 'nba' } = leagueConfig
  const { userPicksWithData, userPicksRemaining } = boardState
  const { strategy = 'beane', injuryTolerance = 'moderate' } = philosophy
  const { budgetRemaining, spendableBudget, avgCostPerRemainingSpot } = auctionContext

  const system = [{ type: 'text', text: BID_ADVICE_SYSTEM, cache_control: { type: 'ephemeral' } }]

  const player     = bidTarget?.player ?? null
  const currentBid = bidTarget?.currentBid ?? 1

  if (!player) return { system, user: 'No player data provided.', maxTokens: 300 }

  const s = player.prior_season
  const auctionVal = player.auction_value ?? '?'
  const injuryTag  = player.injury_risk ? ' ⚠️injury risk' : ''
  const playerLine = `${player.name}(${player.yahoo_positions.join('/')}${injuryTag}) — projected $${auctionVal}. Current bid: $${currentBid}.`

  const roster = userPicksWithData.length > 0
    ? userPicksWithData.map(p => `${p.name}(${p.yahoo_positions.join('/')},$${p.price ?? '?'})`).join(', ')
    : 'Empty'

  const weakCats = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing').map(g => g.label).join(', ')
  const catStatus = categoryGaps.map(g => {
    const isPct = g.id.includes('pct')
    return `${g.label}:${g.current != null ? fmt(g.current, isPct) : '—'}/${fmt(g.benchmark, isPct)}[${g.grade}]`
  }).join(' ')

  const avgStr = avgCostPerRemainingSpot != null ? `$${Math.round(avgCostPerRemainingSpot)} avg/spot` : null
  const budgetLine = [
    budgetRemaining != null ? `$${budgetRemaining} remaining` : null,
    spendableBudget != null ? `$${spendableBudget} max on this player` : null,
    avgStr,
    `${userPicksRemaining} spots left`,
  ].filter(Boolean).join(' · ')

  const strategyLabel = AUCTION_STRATEGY_LABELS[strategy] ?? strategy
  const statsLine = formatCandidateStats(player, sport)

  const user = `${numTeams} teams (${scoringFormat}). Strategy: ${strategyLabel}. Injury tolerance: ${injuryTolerance}.
Budget: ${budgetLine}.
On the block: ${playerLine}
Stats: ${statsLine}
My team: ${roster}
Category status: ${catStatus}
Weak: ${weakCats || 'none'}.`

  return { system, user, maxTokens: 350 }
}

// ─── Auction: watching mode — fires while opponents nominate/bid ──────────────

const AUCTION_WATCHING_SYSTEM = `You are Billy Beane watching opponents nominate and bid. Give ONE casual, confident 1-2 sentence take on the market dynamics. No intro, no sign-off, no "as Billy Beane".

Style examples:
- "The room's burning through budget on guards. Let them — we'll own the frontcourt while they're broke."
- "That went $14 over value. Our budget advantage keeps growing."
- "Three $1 minimum bids in a row. The market's exhausted — this is when we make our move."

Reply ONLY with raw JSON — no markdown, no explanation: {"briefing":"your 1-2 sentence casual take"}`

function buildAuctionWatchingMessages(leagueConfig, boardState, categoryGaps, topCandidates, auctionContext = {}) {
  const { numTeams } = leagueConfig
  const { userPicksWithData } = boardState
  const { nominationNumber, budgetRemaining, spendableBudget } = auctionContext

  const system = [{ type: 'text', text: AUCTION_WATCHING_SYSTEM, cache_control: { type: 'ephemeral' } }]

  const weakCats  = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing').map(g => g.label).join(', ')
  const watchList = (topCandidates ?? []).slice(0, 3).map(c => `${c.player.name}($${c.player.auction_value ?? '?'})`).join(', ')
  const roster    = userPicksWithData.length > 0
    ? userPicksWithData.map(p => p.name).join(', ')
    : 'no picks yet'

  const user = `Nomination #${nominationNumber ?? '?'}. Budget: $${budgetRemaining ?? '?'} left ($${spendableBudget ?? '?'} max single bid).
My team: ${roster}. Need: ${weakCats || 'balanced'}. Watching: ${watchList}.`

  return { system, user, maxTokens: 300 }
}
