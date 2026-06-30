#!/usr/bin/env node
'use strict'

// Plain Node test runner (no framework in this project) — run with:
//   node scripts/test/calculateTrend.test.js

const assert = require('assert')
const { calculateTrend, TREND_THRESHOLD } = require('../calculateTrend')

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

test('roughly stable — combined deviation within +/-15%', () => {
  const prior = { pts: 20, reb: 5, ast: 5 } // total 30
  const current = { pts: 21, reb: 5, ast: 5 } // total 31, +3.3%
  assert.strictEqual(calculateTrend(prior, current), 'stable')
})

test('exactly at the threshold boundary stays stable (strictly greater-than required)', () => {
  const prior = { pts: 20, reb: 5, ast: 5 } // total 30
  const current = { pts: 23, reb: 5, ast: 5.5 } // total 33.5, exactly +15%
  assert.strictEqual(calculateTrend(prior, current), 'stable')
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
