#!/usr/bin/env node
'use strict'

// Plain Node test runner (no framework in this project) — run with:
//   node scripts/test/pitchingStarts.test.js

const assert = require('assert')
const { getPitchingRecommendation } = require('../../src/utils/pitchingStarts')

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

test('healthy pitcher with a scheduled start this week -> start', () => {
  const rec = getPitchingRecommendation({ teamGamesThisWeek: 1, injuryStatus: 'healthy' })
  assert.strictEqual(rec, 'start')
})

test('healthy pitcher with two scheduled starts this week -> start', () => {
  const rec = getPitchingRecommendation({ teamGamesThisWeek: 2, injuryStatus: 'healthy' })
  assert.strictEqual(rec, 'start')
})

test('no scheduled starts this week -> hold, even if healthy', () => {
  const rec = getPitchingRecommendation({ teamGamesThisWeek: 0, injuryStatus: 'healthy' })
  assert.strictEqual(rec, 'hold')
})

test('IL pitcher -> hold, even with scheduled starts', () => {
  const rec = getPitchingRecommendation({ teamGamesThisWeek: 2, injuryStatus: 'il' })
  assert.strictEqual(rec, 'hold')
})

test('injury status is case-insensitive', () => {
  const rec = getPitchingRecommendation({ teamGamesThisWeek: 2, injuryStatus: 'IL' })
  assert.strictEqual(rec, 'hold')
})

test('day-to-day pitcher with a start this week -> stream', () => {
  const rec = getPitchingRecommendation({ teamGamesThisWeek: 1, injuryStatus: 'day-to-day' })
  assert.strictEqual(rec, 'stream')
})

test('day-to-day pitcher with no starts this week -> hold (no starts wins over watch status)', () => {
  const rec = getPitchingRecommendation({ teamGamesThisWeek: 0, injuryStatus: 'day-to-day' })
  assert.strictEqual(rec, 'hold')
})

test('missing injury status defaults to treating the pitcher as healthy', () => {
  const rec = getPitchingRecommendation({ teamGamesThisWeek: 1, injuryStatus: null })
  assert.strictEqual(rec, 'start')
})

// confirmedStarts (real probable-start data, Y-05c) — takes over from the
// teamGamesThisWeek proxy whenever the caller passes it, even an empty array.
test('confirmed start this week -> start, ignoring teamGamesThisWeek', () => {
  const rec = getPitchingRecommendation({
    teamGamesThisWeek: 0, // proxy would say hold — confirmedStarts should win
    injuryStatus: 'healthy',
    confirmedStarts: [{ date: '2026-08-10', opponent: 'TEX', home: true }],
  })
  assert.strictEqual(rec, 'start')
})

test('confirmed two-start week still recommends start (badge is separate)', () => {
  const rec = getPitchingRecommendation({
    teamGamesThisWeek: 5,
    injuryStatus: 'healthy',
    confirmedStarts: [
      { date: '2026-08-10', opponent: 'TEX', home: true },
      { date: '2026-08-15', opponent: 'MIA', home: false },
    ],
  })
  assert.strictEqual(rec, 'start')
})

test('confirmed zero starts this week -> hold, even if teamGamesThisWeek is nonzero', () => {
  const rec = getPitchingRecommendation({
    teamGamesThisWeek: 4, // proxy would say start — real data says otherwise
    injuryStatus: 'healthy',
    confirmedStarts: [],
  })
  assert.strictEqual(rec, 'hold')
})

test('confirmed start with a day-to-day pitcher -> stream', () => {
  const rec = getPitchingRecommendation({
    teamGamesThisWeek: 3,
    injuryStatus: 'day-to-day',
    confirmedStarts: [{ date: '2026-08-10', opponent: 'TEX', home: true }],
  })
  assert.strictEqual(rec, 'stream')
})

test('IL pitcher -> hold even with a confirmed start', () => {
  const rec = getPitchingRecommendation({
    teamGamesThisWeek: 3,
    injuryStatus: 'il',
    confirmedStarts: [{ date: '2026-08-10', opponent: 'TEX', home: true }],
  })
  assert.strictEqual(rec, 'hold')
})

if (failures.length > 0) {
  console.error(`\npitchingStarts.test.js — ${passed} passed, ${failures.length} failed\n`)
  for (const { name, err } of failures) {
    console.error(`  FAIL  ${name}`)
    console.error(`        ${err.message}`)
  }
  process.exit(1)
} else {
  console.log(`pitchingStarts.test.js — ${passed} passed`)
}
