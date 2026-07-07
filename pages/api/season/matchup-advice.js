import Anthropic from '@anthropic-ai/sdk'
import { getValidToken } from '@/utils/yahooAuth'
import fs from 'fs'
import path from 'path'
import { getSportConfig, getPlayerFile } from '@/config/sports'
import { formatStats, formatCurrentSeasonLine, CURRENT_SEASON_REASONING_INSTRUCTION } from '@/ai/seasonStats'
import { normalizeName } from '@/utils/playerName'

const client = new Anthropic()
const BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

function extractMeta(arr) {
  if (!Array.isArray(arr)) return {}
  return Object.assign({}, ...arr.map(x => (typeof x === 'object' && !Array.isArray(x) ? x : {})))
}

async function yahooFetch(token, endpoint) {
  const res = await fetch(`${BASE}${endpoint}?format=json`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Yahoo API ${res.status}: ${text}`)
  }
  return res.json()
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

  try {
  const token = await getValidToken(req, res)
  if (!token) return res.status(401).json({ error: 'Not connected to Yahoo' })

  const { leagueKey, sport = 'nba', leagueRosters, gmProfile } = req.body
  if (!leagueKey || !leagueRosters?.teams) {
    return res.status(400).json({ error: 'leagueKey and leagueRosters required' })
  }

  // Fetch current week's scoreboard
  const scoreboardRaw = await yahooFetch(token, `/league/${leagueKey}/scoreboard`)
  const leagueArr = scoreboardRaw?.fantasy_content?.league
  if (!Array.isArray(leagueArr)) {
    return res.status(502).json({ error: 'Unexpected scoreboard response from Yahoo' })
  }

  const scoreboardSection = leagueArr[1]?.scoreboard
  const firstMatchup = scoreboardSection?.matchups?.['0']?.matchup
  const weekNum = scoreboardSection?.week ?? firstMatchup?.week ?? '?'

  // Find user's matchup in the scoreboard — try both nesting patterns Yahoo uses
  const userTeamKey = leagueRosters.userTeamKey
  let opponentTeamKey = null

  const matchupsObj = scoreboardSection?.matchups ?? scoreboardSection?.['0']?.matchups
  const matchupCount = matchupsObj?.count ?? 0

  for (let i = 0; i < matchupCount; i++) {
    const matchupEntry = matchupsObj[i]?.matchup
    if (!matchupEntry) continue

    // Yahoo returns teams at matchupEntry.teams, matchupEntry["0"].teams, or inside an array
    let teamsObj = null
    if (Array.isArray(matchupEntry)) {
      for (const entry of matchupEntry) {
        if (entry?.teams) { teamsObj = entry.teams; break }
      }
    } else if (matchupEntry?.teams) {
      teamsObj = matchupEntry.teams
    } else if (matchupEntry?.['0']?.teams) {
      teamsObj = matchupEntry['0'].teams
    }
    if (!teamsObj) continue

    const teamCount = teamsObj.count ?? 2
    const teamKeys = []
    for (let j = 0; j < teamCount; j++) {
      const t = teamsObj[j]?.team
      const meta = Array.isArray(t?.[0]) ? extractMeta(t[0]) : {}
      if (meta.team_key) teamKeys.push(meta.team_key)
    }

    if (teamKeys.includes(userTeamKey)) {
      opponentTeamKey = teamKeys.find(k => k !== userTeamKey) ?? null
      break
    }
  }

  if (!opponentTeamKey) {
    // Collect debug info so we can diagnose the mismatch
    const debugMatchups = []
    for (let i = 0; i < matchupCount; i++) {
      const entry = matchupsObj[i]?.matchup
      const teamsSection = Array.isArray(entry)
        ? entry.find(e => e?.teams)?.teams
        : entry?.teams
      const count = teamsSection?.count ?? 0
      const keys = []
      for (let j = 0; j < count; j++) {
        const t = teamsSection[j]?.team
        const m = Array.isArray(t?.[0]) ? extractMeta(t[0]) : {}
        keys.push(m.team_key ?? `[no key at ${j}]`)
      }
      debugMatchups.push(keys)
    }
    console.error('[matchup-advice] userTeamKey:', userTeamKey)
    console.error('[matchup-advice] scoreboard matchup team keys:', JSON.stringify(debugMatchups))
    console.error('[matchup-advice] raw matchupsObj[0]:', JSON.stringify(matchupsObj?.[0]))
    return res.status(404).json({
      error: 'Could not find your matchup this week. Try refreshing your rosters first.',
      debug: { userTeamKey, scoreboardTeamKeys: debugMatchups, rawMatchup0: matchupsObj?.[0] ?? null },
    })
  }

  // Load player data for enriching rosters
  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', getPlayerFile(sport)), 'utf8'))
  const playerById = {}
  const playerByName = {}
  for (const p of players) {
    playerById[p.id] = p
    playerByName[normalizeName(p.name)] = p
  }

  // Match both teams from leagueRosters
  const userTeam = leagueRosters.teams.find(t => t.isUser)
  const oppTeam = leagueRosters.teams.find(t => t.teamKey === opponentTeamKey)

  if (!userTeam) return res.status(400).json({ error: 'User team not found in rosters' })
  if (!oppTeam) {
    return res.status(404).json({ error: 'Opponent team not found — refresh your rosters and try again' })
  }

  function enrichRoster(roster) {
    return roster.map(r => {
      const p = (r.playerId && playerById[r.playerId]) || playerByName[normalizeName(r.name)]
      const injuryTag = p?.injury_risk ? ' ⚠️' : ''
      return `${r.name}(${r.positions ?? '?'}${injuryTag}): ${p ? formatStats(p, sport) : 'no stats'}${p ? formatCurrentSeasonLine(p, sport) : ''}`
    })
  }

  const myRosterLines = enrichRoster(userTeam.roster)
  const oppRosterLines = enrichRoster(oppTeam.roster)

  const sportConfig = getSportConfig(sport)
  const catLine = sportConfig.categories
    .map(c => `${c.label}${sportConfig.lowerIsBetter?.includes(c.id) ? '↓' : ''}`)
    .join(', ')
  const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'

  const gmLine = gmProfile?.injuryTolerance
    ? `\nGM Profile: injury tolerance = ${gmProfile.injuryTolerance}.`
    : ''

  const systemPrompt = `You are Billy Beane previewing a ${sportLabel} fantasy matchup.

Compare both rosters player-by-player. Determine which categories my team wins, loses, or is a tossup based on the stats. Weigh CURRENT season performance over prior-season baseline when both are available — a player trending down in-season may not deliver their prior-season numbers this week, and vice versa. Give an honest 2-3 sentence matchup narrative (Beane voice — direct, data-focused) and one specific lineup or roster note for the week.

All categories in loseCategories and tossupCategories must also appear in winCategories+loseCategories+tossupCategories — don't omit any league categories.

${CURRENT_SEASON_REASONING_INSTRUCTION}

Reply ONLY with raw JSON — no markdown, no extra text:
{"opponent":"Team Name","outlook":"2-3 sentence narrative","winCategories":["R","HR"],"loseCategories":["ERA","WHIP"],"tossupCategories":["RBI","AVG"],"keyNote":"1 sentence action item"}`

  const userPrompt = `Week ${weekNum} matchup · ${sportLabel}
Categories: ${catLine}${gmLine}

MY TEAM (${userTeam.teamName} — W${userTeam.wins}/L${userTeam.losses}):
${myRosterLines.join('\n')}

OPPONENT (${oppTeam.teamName} — W${oppTeam.wins}/L${oppTeam.losses}):
${oppRosterLines.join('\n')}

Give me the matchup breakdown.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    system: [{ type: 'text', text: systemPrompt }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = message.content[0]?.text ?? ''
  const parsed = extractJSON(text)
  res.json({ ...parsed, week: weekNum })

  } catch (err) {
    const cause = err.cause?.message ?? err.cause ?? ''
    console.error('[matchup-advice] error:', err.message, cause ? `| cause: ${cause}` : '')
    res.status(500).json({ error: cause ? `${err.message}: ${cause}` : err.message })
  }
}
