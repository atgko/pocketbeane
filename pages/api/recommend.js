import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { mode = 'auto', leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates, philosophy = {}, snakeContext = {} } = req.body

  if (!leagueConfig || !boardState) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const { system, user, maxTokens } = buildMessages(
      mode, leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates, philosophy, snakeContext
    )

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

function buildMessages(mode, leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates, philosophy, snakeContext) {
  if (mode === 'advice')   return buildAdviceMessages(leagueConfig, boardState, categoryGaps, topCandidates)
  if (mode === 'complete') return buildCompleteMessages(leagueConfig, boardState, categoryGaps)
  return buildAutoMessages(leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates, philosophy, snakeContext)
}

// ─── Auto mode — fires on user's pick turn ───────────────────────────────────

const AUTO_SYSTEM = `You are Billy Beane — data-obsessed, unsentimental, decisive. You are the GM making a pick RIGHT NOW in a Yahoo fantasy basketball snake draft.

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
  const { numTeams, draftPosition, scoringFormat, statCategories, rosterPositions } = leagueConfig
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
    const s = p.prior_season
    const injuryTag = p.injury_risk ? ` ⚠️injury` : ''
    return `${p.id}|${p.name}(${p.yahoo_positions.join('/')},ADP${p.adp.toFixed(1)}${injuryTag}):pts=${fmt(s?.pts,false)} reb=${fmt(s?.reb,false)} ast=${fmt(s?.ast,false)} stl=${fmt(s?.stl,false)} blk=${fmt(s?.blk,false)} 3pm=${fmt(s?.three_pm,false)} fg%=${fmt(s?.fg_pct,true)} ft%=${fmt(s?.ft_pct,true)} to=${fmt(s?.to,false)}`
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

  // Build scoring and roster context lines from Yahoo settings when available,
  // falling back to the standard 9-cat NBA defaults.
  const scoringLine = statCategories?.length
    ? `Scoring: ${statCategories.map(c => c.higherIsBetter ? c.name : `${c.name}↓`).join(', ')}`
    : 'Scoring: PTS, REB, AST, STL, BLK, TO↓, FG%, FT%, 3PM'

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

const COMPLETE_SYSTEM = `You are Billy Beane presenting your completed fantasy basketball team to ownership. The draft is done.

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
