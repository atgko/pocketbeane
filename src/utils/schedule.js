'use strict'

/**
 * schedule.js — Y-05 Start/Sit Advisor
 *
 * Pure date-math over a season-long game list (see src/data/nba_schedule.json,
 * src/data/mlb_schedule.json). No I/O — callers (startsit-advice.js) read and
 * parse the schedule file themselves and pass the resulting object in here.
 *
 * Sport-agnostic by design: a bye week (NFL) or an off-day-heavy week falls
 * out of the same {date, home, away} shape as zero entries for a team in a
 * date range — no sport-specific branching needed in this module. Written as
 * CommonJS (matching scripts/calculateTrend.js) so it's testable via plain
 * `node` and still importable from Next.js API routes via named-import interop.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function parseUTCDate(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`)
}

function toISODate(date) {
  return date.toISOString().slice(0, 10)
}

// getTeamGamesInRange(scheduleData, team, startDate, endDate) -> string[]
//   Sorted ISO date strings for `team`'s games within [startDate, endDate]
//   inclusive. Returns [] for a team with no games in range, including teams
//   entirely absent from scheduleData.games.
function getTeamGamesInRange(scheduleData, team, startDate, endDate) {
  const games = scheduleData?.games ?? []
  const start = parseUTCDate(startDate)
  const end = parseUTCDate(endDate)

  const dates = games
    .filter((g) => g.home === team || g.away === team)
    .filter((g) => {
      const gameDate = parseUTCDate(g.date)
      return gameDate >= start && gameDate <= end
    })
    .map((g) => g.date)

  return [...new Set(dates)].sort()
}

// countGamesInRange(scheduleData, team, startDate, endDate) -> number
function countGamesInRange(scheduleData, team, startDate, endDate) {
  return getTeamGamesInRange(scheduleData, team, startDate, endDate).length
}

// findBackToBacks(gameDates) -> [string, string][]
//   Pairs of consecutive-calendar-day dates within a sorted list of ISO date
//   strings (typically a single team's games from getTeamGamesInRange).
function findBackToBacks(gameDates) {
  const sorted = [...gameDates].sort()
  const pairs = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseUTCDate(sorted[i - 1])
    const curr = parseUTCDate(sorted[i])
    if (curr.getTime() - prev.getTime() === ONE_DAY_MS) {
      pairs.push([sorted[i - 1], sorted[i]])
    }
  }
  return pairs
}

// hasBackToBack(gameDates) -> boolean
function hasBackToBack(gameDates) {
  return findBackToBacks(gameDates).length > 0
}

// getWeekRange(anchorDate) -> { start, end }
//   Monday-Sunday week containing anchorDate (ISO date string in/out).
function getWeekRange(anchorDate) {
  const date = parseUTCDate(anchorDate)
  // getUTCDay(): 0=Sun..6=Sat. Days since the most recent Monday.
  const dayOfWeek = date.getUTCDay()
  const daysSinceMonday = (dayOfWeek + 6) % 7

  const monday = new Date(date.getTime() - daysSinceMonday * ONE_DAY_MS)
  const sunday = new Date(monday.getTime() + 6 * ONE_DAY_MS)

  return { start: toISODate(monday), end: toISODate(sunday) }
}

module.exports = {
  getTeamGamesInRange,
  countGamesInRange,
  findBackToBacks,
  hasBackToBack,
  getWeekRange,
  ONE_DAY_MS,
}
