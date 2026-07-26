'use strict'

/**
 * teamStanding.js — Team Pulse
 *
 * Pure, deterministic team-standing math: no I/O, no LLM call. Sits
 * alongside schedule.js/pitchingStarts.js in the "pure module, testable via
 * plain node" tier of this codebase.
 *
 * Powers three things in the Team Pulse panel:
 *   1. A Contender/Bubble/Rebuilding tier + trend arrow for the user's team
 *      (replaces the never-built "Roster Health Score" 1-10 number).
 *   2. Per-category win rates (this team's total vs. every other team's
 *      total, from prior_season stats) for the user's team and for every
 *      team in the "league landscape" list.
 *   3. Deterministic weak-category detection per opponent, fed into the
 *      trade-value-index prompt so trade-opportunity flags have real signal
 *      about what a team actually needs, not just isolated player value.
 */

// getStandingTier({ rank, numTeams, playoffSpots }) -> 'contender' | 'bubble' | 'rebuilding' | null
//   playoffSpots defaults to the top half of the league when not given (no
//   per-league playoff-spot count exists in league config yet).
//   bubbleMargin scales with league size so a 4-team league doesn't call
//   every team "bubble" — teams within that many spots of the cutoff, on
//   either side, are contested rather than clearly in or out.
function getStandingTier({ rank, numTeams, playoffSpots }) {
  if (rank == null || !numTeams || numTeams <= 0) return null
  const spots = playoffSpots ?? Math.ceil(numTeams / 2)
  const bubbleMargin = Math.max(1, Math.round(numTeams * 0.15))
  if (rank <= spots - bubbleMargin) return 'contender'
  if (rank <= spots + bubbleMargin) return 'bubble'
  return 'rebuilding'
}

// getTrend({ currentRank, previousRank }) -> 'up' | 'down' | 'flat' | null
//   null when there's no previous snapshot to compare against (e.g. the
//   very first roster sync for a league) — a real "no data yet" state
//   rather than a fabricated arrow.
function getTrend({ currentRank, previousRank }) {
  if (currentRank == null || previousRank == null) return null
  if (currentRank < previousRank) return 'up'   // lower rank number is better
  if (currentRank > previousRank) return 'down'
  return 'flat'
}

// aggregateCategoryTotals(players, categories, percentageCategories) -> { [catId]: number|null } | null
//   Same sum-counting/average-percentage approach as
//   src/utils/roster.js's computeCategoryTotals, but takes already-resolved
//   player records instead of {playerId} + a playerId-keyed map — roster
//   entries are resolved to player records differently across call sites
//   (some fall back to name matching when playerId is missing/stale), so
//   this only owns the aggregation step, not the resolution step.
function aggregateCategoryTotals(players, categories, percentageCategories) {
  const resolved = (players ?? []).filter(Boolean)
  if (resolved.length === 0) return null

  const pctSet = new Set(percentageCategories ?? [])
  const result = {}
  for (const cat of categories) {
    const vals = resolved.map(p => p.prior_season?.[cat.id]).filter(v => v != null)
    if (vals.length === 0) { result[cat.id] = null; continue }
    result[cat.id] = pctSet.has(cat.id)
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : vals.reduce((a, b) => a + b, 0)
  }
  return result
}

// getCategoryWinRates({ teamKey, allTeamTotals, categories, lowerIsBetter }) -> { [catId]: { wins, of, rate } | null }
//   allTeamTotals: { [teamKey]: { [catId]: number|null } } for every team in
//   the league (as produced by aggregateCategoryTotals, one call per team).
//   rate is wins / of — how many of the OTHER teams with a comparable total
//   this team's total beats in that category. null when this team or every
//   other team is missing data for that category.
function getCategoryWinRates({ teamKey, allTeamTotals, categories, lowerIsBetter }) {
  const lowerSet = new Set(lowerIsBetter ?? [])
  const myTotals = allTeamTotals[teamKey]
  const otherKeys = Object.keys(allTeamTotals).filter(k => k !== teamKey)

  const result = {}
  for (const cat of categories) {
    const myVal = myTotals?.[cat.id]
    if (myVal == null) { result[cat.id] = null; continue }

    const isLower = lowerSet.has(cat.id)
    let wins = 0
    let of = 0
    for (const otherKey of otherKeys) {
      const otherVal = allTeamTotals[otherKey]?.[cat.id]
      if (otherVal == null) continue
      of++
      const beat = isLower ? myVal < otherVal : myVal > otherVal
      if (beat) wins++
    }
    result[cat.id] = of > 0 ? { wins, of, rate: wins / of } : null
  }
  return result
}

// getOverallWinRate(categoryWinRates) -> number | null
//   Simple average across categories with a computable rate — a compact
//   single-number summary for the league-landscape one-liner.
function getOverallWinRate(categoryWinRates) {
  const rates = Object.values(categoryWinRates)
    .map(r => r?.rate)
    .filter(r => r != null)
  if (rates.length === 0) return null
  return rates.reduce((a, b) => a + b, 0) / rates.length
}

// getWinRateGrade(rate) -> 'strong' | 'ok' | 'weak' | null
//   Same 3-tier grading spirit as src/ai/categoryAnalysis.js's draft-board
//   category grades, thresholded on win rate instead of benchmark progress.
function getWinRateGrade(rate) {
  if (rate == null) return null
  if (rate >= 0.6) return 'strong'
  if (rate >= 0.4) return 'ok'
  return 'weak'
}

module.exports = {
  getStandingTier,
  getTrend,
  aggregateCategoryTotals,
  getCategoryWinRates,
  getOverallWinRate,
  getWinRateGrade,
}
