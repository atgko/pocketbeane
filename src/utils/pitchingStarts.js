'use strict'

/**
 * pitchingStarts.js — MLB Pitching Starts panel
 *
 * Pure, deterministic recommendation logic (no LLM call needed — the input
 * signals are simple enough that a heuristic is more reliable and instant
 * compared to an AI call). Sport-specific to MLB by design: this replaces
 * the general Start/Sit Advisor for MLB (see sports.js startSitMode).
 */

// Injury statuses that mean a pitcher shouldn't occupy a start this week
// regardless of the schedule proxy. 'il' matches this project's MLB data
// (see src/data/mlb_players.json); 'out'/'ir' included defensively in case
// a future data source labels it differently.
const OUT_STATUSES = new Set(['il', 'out', 'ir'])

// Statuses worth a closer look before locking in a start, but not an
// automatic hold.
const WATCH_STATUSES = new Set(['day-to-day', 'questionable', 'doubtful'])

// getPitchingRecommendation({ teamGamesThisWeek, injuryStatus }) -> 'start' | 'stream' | 'hold'
//   teamGamesThisWeek: number — team-schedule games-in-range, used as an
//     approximate proxy for probable starts (see BACKLOG Y-05c: real
//     probable-starts data doesn't exist yet). Named for what it actually
//     measures — a pitcher never starts every one of their team's games.
//   injuryStatus: string | null | undefined
function getPitchingRecommendation({ teamGamesThisWeek, injuryStatus }) {
  const status = injuryStatus?.toLowerCase()
  if (status && OUT_STATUSES.has(status)) return 'hold'
  if (teamGamesThisWeek === 0) return 'hold'
  if (status && WATCH_STATUSES.has(status)) return 'stream'
  return 'start'
}

module.exports = {
  getPitchingRecommendation,
  OUT_STATUSES,
  WATCH_STATUSES,
}
