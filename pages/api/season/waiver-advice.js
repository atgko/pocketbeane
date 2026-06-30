import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { getSportConfig } from '@/config/sports'

const client = new Anthropic()

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fmt(val, isPct) {
  if (val == null) return '—'
  return isPct ? val.toFixed(3) : val.toFixed(1)
}

function formatStats(player, sport) {
  const s = player?.prior_season
  if (!s) return 'rookie/no stats'
  if (sport === 'mlb') {
    const isPitcher = player.yahoo_positions?.some(p => ['SP', 'RP', 'P'].includes(p))
    if (isPitcher) return `w=${fmt(s.w,false)} sv=${fmt(s.sv,false)} k=${fmt(s.k,false)} era=${fmt(s.era,false)} whip=${fmt(s.whip,false)}`
    return `r=${fmt(s.r,false)} hr=${fmt(s.hr,false)} rbi=${fmt(s.rbi,false)} sb=${fmt(s.sb,false)} avg=${fmt(s.avg,true)}`
  }
  return `pts=${fmt(s.pts,false)} reb=${fmt(s.reb,false)} ast=${fmt(s.ast,false)} stl=${fmt(s.stl,false)} blk=${fmt(s.blk,false)} 3pm=${fmt(s.three_pm,false)} fg%=${fmt(s.fg_pct,true)} ft%=${fmt(s.ft_pct,true)}`
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sport = 'nba', leagueRosters, gmProfile } = req.body
  if (!leagueRosters?.teams) return res.status(400).json({ error: 'leagueRosters required' })

  const playerFile = sport === 'mlb' ? 'mlb_players.json' : 'players.json'
  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', playerFile), 'utf8'))

  // Build owned player name set across all teams
  const ownedNames = new Set()
  for (const team of leagueRosters.teams) {
    for (const p of team.roster) {
      if (p.name) ownedNames.add(normalizeName(p.name))
    }
  }

  // Find user's team
  const userTeam = leagueRosters.teams.find(t => t.isUser)
  if (!userTeam) return res.status(400).json({ error: 'User team not found in rosters' })

  // Build lookup maps
  const playerById = {}
  const playerByName = {}
  for (const p of players) {
    playerById[p.id] = p
    playerByName[normalizeName(p.name)] = p
  }

  // Enrich user's roster with stats from players.json
  const userRosterLines = userTeam.roster.map(r => {
    const p = (r.playerId && playerById[r.playerId]) || playerByName[normalizeName(r.name)]
    const injuryTag = p?.injury_risk ? ' ⚠️' : ''
    return `${r.name}(${r.positions ?? '?'}${injuryTag}): ${p ? formatStats(p, sport) : 'no stats'}`
  })

  // Available FAs: unowned players from players.json, sorted by ADP (best first)
  const availableFAs = players
    .filter(p => !ownedNames.has(normalizeName(p.name)))
    .sort((a, b) => a.adp - b.adp)
    .slice(0, 25)
    .map(p => {
      const injuryTag = p.injury_risk ? ' ⚠️' : ''
      return `${p.name}(${p.yahoo_positions?.join('/') ?? '?'},ADP${p.adp?.toFixed(1)}${injuryTag}): ${formatStats(p, sport)}`
    })

  const sportConfig = getSportConfig(sport)
  const catLine = sportConfig.categories.map(c => c.label).join(', ')
  const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'

  const gmLine = gmProfile?.injuryTolerance
    ? `\nGM Profile: injury tolerance = ${gmProfile.injuryTolerance}, strategy = ${gmProfile.draftStrategy ?? 'balanced'}.`
    : ''

  const systemPrompt = `You are Billy Beane advising a ${sportLabel} GM on waiver wire moves.

Analyze the GM's roster against available free agents. Identify the team's weakest categories and recommend exactly 3 add/drop moves that address real gaps. Be specific — name exact players to add and drop. Explain each move in 2-3 sentences using Beane's direct, data-focused voice.

Reply ONLY with raw JSON — no markdown, no extra text:
{"headline":"1 sentence framing what this team most needs","moves":[{"add":"Player Name","drop":"Player Name or null if roster spot open","priority":"must-add|stream|speculative","reason":"2-3 sentences Beane voice"}]}`

  const userPrompt = `${sportLabel} league · Categories: ${catLine}${gmLine}

MY ROSTER (${userTeam.teamName}):
${userRosterLines.join('\n')}

TOP AVAILABLE FREE AGENTS (by projected rank):
${availableFAs.join('\n')}

Recommend 3 waiver wire moves.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      system: [{ type: 'text', text: systemPrompt }],
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = message.content[0]?.text ?? ''
    res.json(extractJSON(text))
  } catch (err) {
    console.error('[waiver-advice]', err)
    res.status(500).json({ error: err.message })
  }
}
