import fs from 'fs'
import path from 'path'
import { getPlayerFile, getScheduleFile } from '@/config/sports'
import { normalizeName } from '@/utils/playerName'
import { getTeamGamesInRange, getWeekRange } from '@/utils/schedule'
import { getPitchingRecommendation } from '@/utils/pitchingStarts'

// MLB-only by design — this panel replaces the general Start/Sit Advisor for
// MLB (see sports.js startSitMode: 'pitching-starts'). Everyday hitters don't
// need a positional start/sit call; the only real weekly lineup lever is
// pitcher starts.
const SPORT = 'mlb'

export function getPitchingStarts({ leagueRosters, weekStart, weekEnd }) {
  if (!leagueRosters?.teams) throw new Error('leagueRosters required')

  const userTeam = leagueRosters.teams.find(t => t.isUser)
  if (!userTeam) throw new Error('User team not found in rosters')

  const scheduleFilePath = path.join(process.cwd(), 'src/data', getScheduleFile(SPORT))
  const schedule = JSON.parse(fs.readFileSync(scheduleFilePath, 'utf8'))
  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', getPlayerFile(SPORT)), 'utf8'))

  const playerById = {}
  const playerByName = {}
  for (const p of players) {
    playerById[p.id] = p
    playerByName[normalizeName(p.name)] = p
  }

  const { start, end } = weekStart && weekEnd
    ? { start: weekStart, end: weekEnd }
    : getWeekRange(new Date().toISOString().slice(0, 10))

  const starts = userTeam.roster
    .map(r => (r.playerId && playerById[r.playerId]) || playerByName[normalizeName(r.name)])
    .filter(p => p?.yahoo_positions?.includes('SP'))
    .map(p => {
      const gameDates = p.team ? getTeamGamesInRange(schedule, p.team, start, end) : []
      const injuryStatus = p.current_season?.injury_status ?? p.injury_status ?? null
      const injuryNote = p.current_season?.injury_note ?? p.injury_notes ?? null
      const teamGamesThisWeek = gameDates.length
      return {
        player: p.name,
        team: p.team ?? null,
        teamGamesThisWeek,
        injuryStatus,
        injuryNote,
        recommendation: getPitchingRecommendation({ teamGamesThisWeek, injuryStatus }),
      }
    })
    .sort((a, b) => b.teamGamesThisWeek - a.teamGamesThisWeek)

  return { week: { start, end }, starts }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { leagueRosters, weekStart, weekEnd } = req.body

  try {
    const result = getPitchingStarts({ leagueRosters, weekStart, weekEnd })
    res.json(result)
  } catch (err) {
    console.error('[pitching-starts]', err)
    const isClientError = ['leagueRosters required', 'User team not found in rosters'].includes(err.message)
    res.status(isClientError ? 400 : 500).json({ error: err.message })
  }
}
