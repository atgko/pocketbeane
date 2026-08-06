import fs from 'fs'
import path from 'path'
import { getPlayerFile, getScheduleFile, getProbablesFile } from '@/config/sports'
import { normalizeName } from '@/utils/playerName'
import { getTeamGamesInRange, getWeekRange } from '@/utils/schedule'
import { getPitcherStartsInRange, hasFullCoverage, isProbablesDataUsable } from '@/utils/probables'
import { getPitchingRecommendation } from '@/utils/pitchingStarts'

// MLB-only by design — this panel replaces the general Start/Sit Advisor for
// MLB (see sports.js startSitMode: 'pitching-starts'). Everyday hitters don't
// need a positional start/sit call; the only real weekly lineup lever is
// pitcher starts.
const SPORT = 'mlb'

// Real probable-starts data (see scripts/fetch_mlb_probables.py, BACKLOG
// Y-05c) is missing until Hermes' first run against this file, or can go
// stale between runs — never let either case break the panel. Falls back to
// null, which getPitchingStarts treats as "use the schedule proxy".
function loadProbables() {
  const probablesFile = getProbablesFile(SPORT)
  if (!probablesFile) return null
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'src/data', probablesFile), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function getPitchingStarts({ leagueRosters, weekStart, weekEnd }) {
  if (!leagueRosters?.teams) throw new Error('leagueRosters required')

  const userTeam = leagueRosters.teams.find(t => t.isUser)
  if (!userTeam) throw new Error('User team not found in rosters')

  const scheduleFilePath = path.join(process.cwd(), 'src/data', getScheduleFile(SPORT))
  const schedule = JSON.parse(fs.readFileSync(scheduleFilePath, 'utf8'))
  const players = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data', getPlayerFile(SPORT)), 'utf8'))
  const probables = loadProbables()

  const playerById = {}
  const playerByName = {}
  for (const p of players) {
    playerById[p.id] = p
    playerByName[normalizeName(p.name)] = p
  }

  const { start, end } = weekStart && weekEnd
    ? { start: weekStart, end: weekEnd }
    : getWeekRange(new Date().toISOString().slice(0, 10))

  // Only trust the probables file for this week if it's fresh AND its
  // scraped window actually covers [start, end] — probable starts aren't
  // announced until ~5 days out, so a week extending past the scraped
  // horizon must fall back to the schedule proxy rather than reading "no
  // rows yet" as a confirmed zero-start week.
  const probablesTrusted = isProbablesDataUsable(probables) && hasFullCoverage(probables, start, end)

  const starts = userTeam.roster
    .map(r => (r.playerId && playerById[r.playerId]) || playerByName[normalizeName(r.name)])
    .filter(p => p?.yahoo_positions?.includes('SP'))
    .map(p => {
      const gameDates = p.team ? getTeamGamesInRange(schedule, p.team, start, end) : []
      const injuryStatus = p.current_season?.injury_status ?? p.injury_status ?? null
      const injuryNote = p.current_season?.injury_note ?? p.injury_notes ?? null
      const teamGamesThisWeek = gameDates.length

      const confirmedStarts = probablesTrusted
        ? getPitcherStartsInRange(probables, { pitcherId: p.id, name: p.name }, start, end)
        : null

      return {
        player: p.name,
        team: p.team ?? null,
        teamGamesThisWeek,
        confirmedStarts,
        twoStartWeek: confirmedStarts ? confirmedStarts.length >= 2 : false,
        injuryStatus,
        injuryNote,
        recommendation: getPitchingRecommendation({
          teamGamesThisWeek,
          injuryStatus,
          confirmedStarts: confirmedStarts ?? undefined,
        }),
      }
    })
    .sort((a, b) => {
      const aCount = a.confirmedStarts ? a.confirmedStarts.length : a.teamGamesThisWeek
      const bCount = b.confirmedStarts ? b.confirmedStarts.length : b.teamGamesThisWeek
      return bCount - aCount
    })

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
