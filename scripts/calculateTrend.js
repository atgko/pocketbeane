'use strict'

/**
 * calculateTrend.js — T1-3
 *
 * Pure function: compares a player's current-season performance against their
 * prior-season baseline and classifies them as improving, declining, or stable.
 * No side effects, no I/O — called from mergeCurrentSeasonData.js (T1-2).
 */

const TREND_THRESHOLD = 0.15

// Primary signal — most stable, cross-position indicators of overall production.
const TREND_SIGNAL_STATS = ['pts', 'reb', 'ast']

// calculateTrend(priorSeason, currentSeason) -> 'improving' | 'stable' | 'declining'
// Compares the combined total of TREND_SIGNAL_STATS between seasons. A combined
// deviation beyond TREND_THRESHOLD in either direction is trending; otherwise stable.
function calculateTrend(priorSeason, currentSeason) {
  if (!priorSeason || !currentSeason) return 'stable'

  let priorTotal = 0
  let currentTotal = 0

  for (const stat of TREND_SIGNAL_STATS) {
    const prior = priorSeason[stat]
    const current = currentSeason[stat]
    if (typeof prior !== 'number' || typeof current !== 'number') return 'stable'
    priorTotal += prior
    currentTotal += current
  }

  if (priorTotal === 0) return 'stable'

  const deviation = (currentTotal - priorTotal) / priorTotal

  if (deviation > TREND_THRESHOLD) return 'improving'
  if (deviation < -TREND_THRESHOLD) return 'declining'
  return 'stable'
}

module.exports = { calculateTrend, TREND_THRESHOLD, TREND_SIGNAL_STATS }
