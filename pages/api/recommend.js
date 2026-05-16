import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { mode = 'auto', leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates } = req.body

  if (!leagueConfig || !boardState) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    let prompt
    if (mode === 'advice') {
      prompt = buildAdvicePrompt(leagueConfig, boardState, categoryGaps, topCandidates)
    } else if (mode === 'complete') {
      prompt = buildCompletePrompt(leagueConfig, boardState, categoryGaps)
    } else {
      prompt = buildAutoPrompt(leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates)
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: mode === 'advice' ? 300 : 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON returned by model')

    res.json({ mode, ...JSON.parse(match[0]) })
  } catch (err) {
    console.error('[recommend]', err)
    res.status(500).json({ error: err.message || 'Failed to get recommendation' })
  }
}

function fmt(val, isPct) {
  if (val == null) return '—'
  return isPct ? val.toFixed(3) : val.toFixed(1)
}

// Full analysis for user's pick turn — 3 picks, category analysis, Moneyball voice
function buildAutoPrompt(leagueConfig, boardState, categoryGaps, scarcityAlerts, topCandidates) {
  const { numTeams, draftPosition, scoringFormat } = leagueConfig
  const { userPicksWithData, totalPicks, currentRound, userPicksRemaining } = boardState

  const roster = userPicksWithData.length > 0
    ? userPicksWithData.map(p => `${p.name}(${p.yahoo_positions.join('/')})`).join(', ')
    : 'Empty — first pick'

  const weakCats = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing').map(g => g.label).join(', ')
  const strongCats = categoryGaps.filter(g => g.grade === 'strong').map(g => g.label).join(', ')

  const catStatus = categoryGaps
    .map(g => {
      const isPct = g.id.includes('pct')
      return `${g.label}:${g.current != null ? fmt(g.current, isPct) : '—'}/${fmt(g.benchmark, isPct)}[${g.grade}]`
    })
    .join(' ')

  const candidates = (topCandidates ?? []).slice(0, 8).map(c => {
    const p = c.player
    const s = p.prior_season
    return `${p.id}|${p.name}(${p.yahoo_positions.join('/')},ADP${p.adp.toFixed(1)}):pts=${fmt(s?.pts,false)} reb=${fmt(s?.reb,false)} ast=${fmt(s?.ast,false)} stl=${fmt(s?.stl,false)} blk=${fmt(s?.blk,false)} 3pm=${fmt(s?.three_pm,false)} fg%=${fmt(s?.fg_pct,true)} ft%=${fmt(s?.ft_pct,true)} to=${fmt(s?.to,false)}`
  }).join('\n')

  const alertLine = scarcityAlerts?.length > 0 ? `\nSCARCITY: ${scarcityAlerts.join(' ')}` : ''

  return `You are Billy Beane — data-obsessed, unsentimental, decisive. You're the GM making THIS pick RIGHT NOW in a Yahoo ${scoringFormat} fantasy basketball snake draft.

${numTeams} teams, pick position ${draftPosition}. Round ${currentRound}, pick #${totalPicks + 1}. ${userPicksRemaining} roster spots left.
My team: ${roster}
Category status (current/benchmark[grade]): ${catStatus}
Weak: ${weakCats || 'none'}. Strong: ${strongCats || 'none'}.${alertLine}

Top available (by team fit):
${candidates}

Reply ONLY with JSON. Picks must use the id from the list above.
{"picks":[{"id":"player-id","name":"Name","reason":"one confident Beane-voice sentence, specific about which category this fixes or which market mispricing you're exploiting"},{"id":"...","name":"...","reason":"..."},{"id":"...","name":"...","reason":"..."}],"scarcityAlerts":["string if urgency, else empty array"],"summary":"2-3 sentences. GM voice. Specific categories. No filler."}`
}

// Brief casual take during opponent picks — 1-2 sentences max
function buildAdvicePrompt(leagueConfig, boardState, categoryGaps, topCandidates) {
  const { numTeams } = leagueConfig
  const { userPicksWithData, totalPicks, currentRound } = boardState

  const opponentPicksLeft = numTeams - (totalPicks % numTeams) - 1
  const weakCats = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing').map(g => g.label).join(', ')
  const watchList = (topCandidates ?? []).slice(0, 3).map(c => `${c.player.name}(ADP${c.player.adp.toFixed(1)})`).join(', ')
  const roster = userPicksWithData.length > 0
    ? userPicksWithData.map(p => p.name).join(', ')
    : 'no picks yet'

  return `You are Billy Beane watching opponents draft. Give ONE casual, confident 1-2 sentence take. No intro, no sign-off.

Round ${currentRound}, ${opponentPicksLeft} opponent picks remaining before my turn.
My team: ${roster}. Need: ${weakCats || 'balanced'}. Watching: ${watchList}.

Style examples:
- "I'd keep an eye on Barnes — threes and boards, exactly what we need. He won't last much longer."
- "The market's sleeping on rebounders right now. If one falls to us, that's our pick."
- "Let them fight over point guards. We're waiting for the big who fixes our FG%."

Reply ONLY with JSON: {"briefing":"your 1-2 sentence casual take"}`
}

// Season outlook after draft is complete
function buildCompletePrompt(leagueConfig, boardState, categoryGaps) {
  const { name, numTeams } = leagueConfig
  const { userPicksWithData } = boardState

  const roster = userPicksWithData.map(p => `${p.name}(${p.yahoo_positions.join('/')})`).join(', ')
  const grades = categoryGaps.map(g => `${g.label}[${g.grade}]`).join(' ')
  const strong = categoryGaps.filter(g => g.grade === 'strong').map(g => g.label).join(', ')
  const weak = categoryGaps.filter(g => g.grade === 'weak').map(g => g.label).join(', ')

  return `You are Billy Beane presenting your completed fantasy basketball team to ownership. Draft is done.

League: ${name} (${numTeams} teams)
Final roster: ${roster}
Category grades: ${grades}
Strengths: ${strong || 'none yet'}. Vulnerabilities: ${weak || 'none'}.

Write your GM's season report. 3-4 sentences. What's the team built around? Where's the vulnerability and how do you exploit the waiver wire for it? End with a bold, specific prediction.

Reply ONLY with JSON: {"outlook":"your 3-4 sentence GM season report"}`
}
