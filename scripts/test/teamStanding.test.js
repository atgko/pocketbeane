#!/usr/bin/env node
'use strict'

// Plain Node test runner (no framework in this project) — run with:
//   node scripts/test/teamStanding.test.js

const assert = require('assert')
const {
  getStandingTier,
  getTrend,
  aggregateCategoryTotals,
  getCategoryWinRates,
  getOverallWinRate,
  getWinRateGrade,
} = require('../../src/utils/teamStanding')

let passed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed++
  } catch (err) {
    failures.push({ name, err })
  }
}

// ─── getStandingTier ────────────────────────────────────────────────────────

test('rank 1 of 10 (playoffSpots defaults to top half = 5) is a contender', () => {
  assert.strictEqual(getStandingTier({ rank: 1, numTeams: 10 }), 'contender')
})

test('rank 5 of 10 sits right at the cutoff -> bubble', () => {
  assert.strictEqual(getStandingTier({ rank: 5, numTeams: 10 }), 'bubble')
})

test('rank 10 of 10 (last place) is rebuilding', () => {
  assert.strictEqual(getStandingTier({ rank: 10, numTeams: 10 }), 'rebuilding')
})

test('explicit playoffSpots overrides the top-half default', () => {
  // 12-team league, only 4 playoff spots, bubbleMargin = max(1, round(12*0.15)) = 2
  assert.strictEqual(getStandingTier({ rank: 2, numTeams: 12, playoffSpots: 4 }), 'contender')
  assert.strictEqual(getStandingTier({ rank: 6, numTeams: 12, playoffSpots: 4 }), 'bubble')
  assert.strictEqual(getStandingTier({ rank: 10, numTeams: 12, playoffSpots: 4 }), 'rebuilding')
})

test('missing rank returns null rather than guessing', () => {
  assert.strictEqual(getStandingTier({ rank: null, numTeams: 10 }), null)
})

test('missing numTeams returns null', () => {
  assert.strictEqual(getStandingTier({ rank: 1, numTeams: null }), null)
})

// ─── getTrend ───────────────────────────────────────────────────────────────

test('rank improved (lower number) -> up', () => {
  assert.strictEqual(getTrend({ currentRank: 2, previousRank: 5 }), 'up')
})

test('rank worsened (higher number) -> down', () => {
  assert.strictEqual(getTrend({ currentRank: 6, previousRank: 3 }), 'down')
})

test('unchanged rank -> flat', () => {
  assert.strictEqual(getTrend({ currentRank: 4, previousRank: 4 }), 'flat')
})

test('no previous snapshot -> null, not a fabricated arrow', () => {
  assert.strictEqual(getTrend({ currentRank: 4, previousRank: null }), null)
})

// ─── aggregateCategoryTotals ────────────────────────────────────────────────

const playerA = { prior_season: { pts: 20, fg_pct: 0.5 } }
const playerB = { prior_season: { pts: 10, fg_pct: 0.4 } }
const categories = [{ id: 'pts' }, { id: 'fg_pct' }]

test('counting stats are summed, percentage stats are averaged', () => {
  const totals = aggregateCategoryTotals([playerA, playerB], categories, ['fg_pct'])
  assert.strictEqual(totals.pts, 30)
  assert.strictEqual(totals.fg_pct, 0.45)
})

test('null/undefined players in the list are dropped, not crashed on', () => {
  const totals = aggregateCategoryTotals([playerA, null, undefined, playerB], categories, ['fg_pct'])
  assert.strictEqual(totals.pts, 30)
})

test('a category with no data across all players comes back null', () => {
  const totals = aggregateCategoryTotals([{ prior_season: {} }], categories, ['fg_pct'])
  assert.strictEqual(totals.pts, null)
})

test('an empty roster returns null, not an empty object', () => {
  assert.strictEqual(aggregateCategoryTotals([], categories, []), null)
})

// ─── getCategoryWinRates ────────────────────────────────────────────────────

const threeTeamTotals = {
  teamA: { pts: 30, to: 5 },
  teamB: { pts: 20, to: 3 },
  teamC: { pts: 10, to: 8 },
}

test('higher-is-better category: most points beats both others -> rate 1', () => {
  const rates = getCategoryWinRates({ teamKey: 'teamA', allTeamTotals: threeTeamTotals, categories: [{ id: 'pts' }], lowerIsBetter: [] })
  assert.deepStrictEqual(rates.pts, { wins: 2, of: 2, rate: 1 })
})

test('higher-is-better category: fewest points beats neither -> rate 0', () => {
  const rates = getCategoryWinRates({ teamKey: 'teamC', allTeamTotals: threeTeamTotals, categories: [{ id: 'pts' }], lowerIsBetter: [] })
  assert.deepStrictEqual(rates.pts, { wins: 0, of: 2, rate: 0 })
})

test('lower-is-better category flips the comparison', () => {
  // teamB has the fewest turnovers (3), so it should beat both others when lower is better
  const rates = getCategoryWinRates({ teamKey: 'teamB', allTeamTotals: threeTeamTotals, categories: [{ id: 'to' }], lowerIsBetter: ['to'] })
  assert.deepStrictEqual(rates.to, { wins: 2, of: 2, rate: 1 })
})

test('a category missing on this team returns null for that category', () => {
  const rates = getCategoryWinRates({ teamKey: 'teamA', allTeamTotals: threeTeamTotals, categories: [{ id: 'reb' }], lowerIsBetter: [] })
  assert.strictEqual(rates.reb, null)
})

test('a category missing on every other team returns null (nothing to compare against)', () => {
  const totals = { teamA: { pts: 10 }, teamB: { pts: null } }
  const rates = getCategoryWinRates({ teamKey: 'teamA', allTeamTotals: totals, categories: [{ id: 'pts' }], lowerIsBetter: [] })
  assert.strictEqual(rates.pts, null)
})

// ─── getOverallWinRate / getWinRateGrade ────────────────────────────────────

test('overall win rate averages the per-category rates', () => {
  const rates = { pts: { rate: 1 }, reb: { rate: 0.5 }, ast: { rate: 0 } }
  assert.strictEqual(getOverallWinRate(rates), 0.5)
})

test('overall win rate ignores categories with a null rate', () => {
  const rates = { pts: { rate: 1 }, reb: null }
  assert.strictEqual(getOverallWinRate(rates), 1)
})

test('overall win rate is null when nothing is computable', () => {
  assert.strictEqual(getOverallWinRate({ pts: null }), null)
})

test('win rate grade thresholds: >=0.6 strong, >=0.4 ok, below weak', () => {
  assert.strictEqual(getWinRateGrade(0.6), 'strong')
  assert.strictEqual(getWinRateGrade(0.4), 'ok')
  assert.strictEqual(getWinRateGrade(0.39), 'weak')
  assert.strictEqual(getWinRateGrade(null), null)
})

if (failures.length > 0) {
  console.error(`\nteamStanding.test.js — ${passed} passed, ${failures.length} failed\n`)
  for (const { name, err } of failures) {
    console.error(`  FAIL  ${name}`)
    console.error(`        ${err.message}`)
  }
  process.exit(1)
} else {
  console.log(`teamStanding.test.js — ${passed} passed`)
}
