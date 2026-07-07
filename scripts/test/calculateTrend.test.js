#!/usr/bin/env node
'use strict'

// Plain Node test runner (no framework in this project) — run with:
//   node scripts/test/calculateTrend.test.js

const assert = require('assert')
const { calculateTrend, TREND_THRESHOLD, TREND_MINOR_THRESHOLD, TREND_PROFILES } = require('../calculateTrend')

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

test('threshold is a named constant of 0.15', () => {
  assert.strictEqual(TREND_THRESHOLD, 0.15)
})

test('minor threshold is a named constant of 0.05', () => {
  assert.strictEqual(TREND_MINOR_THRESHOLD, 0.05)
})

test('significantly improving — combined deviation > 15%', () => {
  const prior = { pts: 20, reb: 5, ast: 5 } // total 30
  const current = { pts: 25, reb: 6, ast: 6 } // total 37, +23.3%
  assert.strictEqual(calculateTrend(prior, current), 'improving')
})

test('significantly declining — combined deviation < -15%', () => {
  const prior = { pts: 20, reb: 5, ast: 5 } // total 30
  const current = { pts: 15, reb: 4, ast: 4 } // total 23, -23.3%
  assert.strictEqual(calculateTrend(prior, current), 'declining')
})

test('roughly stable — combined deviation within +/-5%', () => {
  const prior = { pts: 20, reb: 5, ast: 5 } // total 30
  const current = { pts: 21, reb: 5, ast: 5 } // total 31, +3.3%
  assert.strictEqual(calculateTrend(prior, current), 'stable')
})

test('slightly improving — combined deviation between 5% and 15%', () => {
  const prior = { pts: 20, reb: 5, ast: 5 } // total 30
  const current = { pts: 22, reb: 5, ast: 5 } // total 32, +6.7%
  assert.strictEqual(calculateTrend(prior, current), 'slightly-improving')
})

test('slightly declining — combined deviation between -5% and -15%', () => {
  const prior = { pts: 20, reb: 5, ast: 5 } // total 30
  const current = { pts: 18, reb: 5, ast: 5 } // total 28, -6.7%
  assert.strictEqual(calculateTrend(prior, current), 'slightly-declining')
})

test('exactly at the minor threshold boundary stays stable (strictly greater-than required)', () => {
  const prior = { pts: 20, reb: 5, ast: 5 } // total 30
  const current = { pts: 21.5, reb: 5, ast: 5 } // total 31.5, exactly +5%
  assert.strictEqual(calculateTrend(prior, current), 'stable')
})

test('exactly at the major threshold boundary is slightly-improving, not improving (strictly greater-than required)', () => {
  const prior = { pts: 20, reb: 5, ast: 5 } // total 30
  const current = { pts: 23, reb: 5, ast: 5.5 } // total 33.5, exactly +15%
  assert.strictEqual(calculateTrend(prior, current), 'slightly-improving')
})

test('missing prior_season (null) falls back to stable', () => {
  assert.strictEqual(calculateTrend(null, { pts: 25, reb: 6, ast: 6 }), 'stable')
})

test('missing current_season (null) falls back to stable', () => {
  assert.strictEqual(calculateTrend({ pts: 20, reb: 5, ast: 5 }, null), 'stable')
})

test('matches real sample data — Jokic prior/current is stable', () => {
  const prior = { pts: 27.7, reb: 12.9, ast: 10.7 }
  const current = { pts: 26.8, reb: 12.5, ast: 10.9 }
  assert.strictEqual(calculateTrend(prior, current), 'stable')
})

test('mlb_pitcher profile: falling ERA/WHIP with rising K reads as improving', () => {
  const prior = { k: 4.43, era: 2.87, whip: 1.043 } // per-game rates
  const current = { k: 6.79, era: 1.79, whip: 0.946 }
  assert.strictEqual(calculateTrend(prior, current, TREND_PROFILES.mlb_pitcher), 'improving')
})

test('mlb_pitcher profile: regression guard — small positive K-rate must not flip a blown-up ERA/WHIP into "improving"', () => {
  // Reproduces the Carlos Estevez case: a tiny K-rate summed against sign-flipped
  // ERA/WHIP used to push the summed prior total negative, inverting the deviation's
  // sign. A disastrous outing (ERA 2.45->162, WHIP 1.061->18, K-rate collapses to 0)
  // must read as declining, not improving.
  const prior = { k: 0.806, era: 2.45, whip: 1.061 }
  const current = { k: 0, era: 162, whip: 18 }
  assert.strictEqual(calculateTrend(prior, current, TREND_PROFILES.mlb_pitcher), 'declining')
})

test('mlb_hitter profile: per-game rate comparison reads as stable when the per-game rate is truly unchanged', () => {
  // A partial season (84 games) at the exact same per-game HR/RBI rate as a
  // full prior season (157 games) must not read as "declining" just because
  // the season-to-date totals are lower.
  const rate = { hr: 20 / 157, rbi: 80 / 157, avg: 0.295 }
  assert.strictEqual(calculateTrend(rate, rate, TREND_PROFILES.mlb_hitter), 'stable')
})

test('mlb_hitter profile: a real but modest per-game rate decline reads as slightly-declining, not stable', () => {
  // Real sample data (Bobby Witt): the old single-threshold model rounded
  // this ~14% per-game decline down to "stable". The 5-tier model should
  // now surface it as real, modest movement instead of hiding it.
  const prior = { hr: 23 / 157, rbi: 88 / 157, avg: 0.295 }
  const current = { hr: 12 / 84, rbi: 36 / 84, avg: 0.29 }
  assert.strictEqual(calculateTrend(prior, current, TREND_PROFILES.mlb_hitter), 'slightly-declining')
})

test('is a pure function — does not mutate its inputs', () => {
  const prior = { pts: 20, reb: 5, ast: 5 }
  const current = { pts: 25, reb: 6, ast: 6 }
  const priorCopy = { ...prior }
  const currentCopy = { ...current }
  calculateTrend(prior, current)
  assert.deepStrictEqual(prior, priorCopy)
  assert.deepStrictEqual(current, currentCopy)
})

if (failures.length > 0) {
  console.error(`\ncalculateTrend.test.js — ${passed} passed, ${failures.length} failed\n`)
  for (const { name, err } of failures) {
    console.error(`  FAIL  ${name}`)
    console.error(`        ${err.message}`)
  }
  process.exit(1)
} else {
  console.log(`calculateTrend.test.js — ${passed} passed`)
}
