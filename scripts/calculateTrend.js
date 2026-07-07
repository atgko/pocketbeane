'use strict'

/**
 * calculateTrend.js — T1-3
 *
 * Pure function: compares a player's current-season performance against their
 * prior-season baseline and classifies them as improving, declining, or stable.
 * No side effects, no I/O — called from mergeCurrentSeasonData.js (T1-2).
 */

const TREND_THRESHOLD = 0.15
// Anything between this and TREND_THRESHOLD is real movement, just not big
// enough to call a full "improving"/"declining" — reads as "slightly-*".
const TREND_MINOR_THRESHOLD = 0.05

// Primary signal — most stable, cross-position indicators of overall production.
const TREND_SIGNAL_STATS = ['pts', 'reb', 'ast']

// Per-sport / per-position-type signal profiles (see docs/SCHEMA.md "Trend
// calculation"). `lowerIsBetter` stats (ERA, WHIP) are sign-flipped before
// summing so a falling ERA reads as "improving", not "declining".
const TREND_PROFILES = {
  nba: { stats: TREND_SIGNAL_STATS },
  mlb_hitter: { stats: ['hr', 'rbi', 'avg'] },
  mlb_pitcher: { stats: ['k', 'era', 'whip'], lowerIsBetter: ['era', 'whip'] },
}

// Original NBA methodology, unchanged: sum the raw stats on each side, then
// take one deviation of the two totals. Safe only when every stat in the
// profile is "higher is better" (no sign flips) — summing same-sign values
// can never cross zero the way a sign-flipped mix can.
function summedTotalDeviation(priorSeason, currentSeason, stats) {
  let priorTotal = 0
  let currentTotal = 0

  for (const stat of stats) {
    const prior = priorSeason[stat]
    const current = currentSeason[stat]
    if (typeof prior !== 'number' || typeof current !== 'number') return null
    priorTotal += prior
    currentTotal += current
  }

  if (priorTotal === 0) return null
  return (currentTotal - priorTotal) / priorTotal
}

// Used for profiles with `lowerIsBetter` stats (e.g. ERA/WHIP). Summing a
// sign-flipped stat alongside a "higher is better" one (e.g. K) can push the
// combined total negative and invert the whole deviation's meaning — so each
// stat's percentage deviation is computed independently (sign-flipped first,
// where applicable) and averaged, avoiding any cross-stat sign cancellation.
function averagedPercentDeviation(priorSeason, currentSeason, stats, lowerIsBetter) {
  const deviations = []

  for (const stat of stats) {
    const prior = priorSeason[stat]
    const current = currentSeason[stat]
    if (typeof prior !== 'number' || typeof current !== 'number') return null
    if (prior === 0) continue
    const raw = (current - prior) / Math.abs(prior)
    deviations.push(lowerIsBetter.includes(stat) ? -raw : raw)
  }

  if (deviations.length === 0) return null
  return deviations.reduce((sum, d) => sum + d, 0) / deviations.length
}

// calculateTrend(priorSeason, currentSeason, profile?) ->
//   'improving' | 'slightly-improving' | 'stable' | 'slightly-declining' | 'declining'
// Default profile (NBA pts/reb/ast) uses the original summed-total deviation.
// Profiles with `lowerIsBetter` stats use an averaged per-stat percentage
// deviation instead, since those can't be safely summed with "higher is
// better" stats. A deviation beyond TREND_THRESHOLD in either direction is a
// full "improving"/"declining"; beyond TREND_MINOR_THRESHOLD but not
// TREND_THRESHOLD is "slightly-*"; otherwise stable.
function calculateTrend(priorSeason, currentSeason, profile = TREND_PROFILES.nba) {
  if (!priorSeason || !currentSeason) return 'stable'

  const { stats, lowerIsBetter = [] } = profile

  const deviation = lowerIsBetter.length > 0
    ? averagedPercentDeviation(priorSeason, currentSeason, stats, lowerIsBetter)
    : summedTotalDeviation(priorSeason, currentSeason, stats)

  if (deviation === null) return 'stable'
  if (deviation > TREND_THRESHOLD) return 'improving'
  if (deviation > TREND_MINOR_THRESHOLD) return 'slightly-improving'
  if (deviation < -TREND_THRESHOLD) return 'declining'
  if (deviation < -TREND_MINOR_THRESHOLD) return 'slightly-declining'
  return 'stable'
}

module.exports = { calculateTrend, TREND_THRESHOLD, TREND_MINOR_THRESHOLD, TREND_SIGNAL_STATS, TREND_PROFILES }
