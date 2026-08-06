#!/usr/bin/env node
'use strict'

// Plain Node test runner (no framework in this project) — run with:
//   node scripts/test/probables.test.js

const assert = require('assert')
const {
  getPitcherStartsInRange,
  hasFullCoverage,
  isProbablesDataUsable,
  normalizePitcherName,
} = require('../../src/utils/probables')

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

const SAMPLE = {
  stale: false,
  date_range: { start: '2026-08-05', end: '2026-08-15' },
  starts: [
    { date: '2026-08-05', team: 'LAA', opponent: 'BAL', home: false, pitcher_id: 'reid-detmers', pitcher_name: 'Reid Detmers' },
    { date: '2026-08-10', team: 'LAA', opponent: 'TEX', home: true, pitcher_id: 'reid-detmers', pitcher_name: 'Reid Detmers' },
    { date: '2026-08-08', team: 'SEA', opponent: 'TBR', home: true, pitcher_id: null, pitcher_name: 'Bryce Miller' },
  ],
}

test('getPitcherStartsInRange matches by pitcherId and sorts by date', () => {
  const starts = getPitcherStartsInRange(SAMPLE, { pitcherId: 'reid-detmers' }, '2026-08-05', '2026-08-11')
  assert.strictEqual(starts.length, 2)
  assert.strictEqual(starts[0].date, '2026-08-05')
  assert.strictEqual(starts[1].date, '2026-08-10')
})

test('getPitcherStartsInRange respects the date range boundaries', () => {
  const starts = getPitcherStartsInRange(SAMPLE, { pitcherId: 'reid-detmers' }, '2026-08-05', '2026-08-05')
  assert.strictEqual(starts.length, 1)
  assert.strictEqual(starts[0].date, '2026-08-05')
})

test('getPitcherStartsInRange falls back to name matching when pitcher_id is null', () => {
  const starts = getPitcherStartsInRange(SAMPLE, { pitcherId: 'bryce-miller', name: 'Bryce Miller' }, '2026-08-01', '2026-08-15')
  assert.strictEqual(starts.length, 1)
  assert.strictEqual(starts[0].opponent, 'TBR')
})

test('getPitcherStartsInRange does not fall back to name matching when a row has a pitcher_id (avoids false positives)', () => {
  // A different pitcher sharing a normalized name would never match a row
  // the scraper already resolved to someone else's id.
  const starts = getPitcherStartsInRange(SAMPLE, { pitcherId: 'someone-else', name: 'Reid Detmers' }, '2026-08-01', '2026-08-15')
  assert.strictEqual(starts.length, 0)
})

test('getPitcherStartsInRange returns empty for a pitcher with no rows', () => {
  const starts = getPitcherStartsInRange(SAMPLE, { pitcherId: 'nobody' }, '2026-08-01', '2026-08-15')
  assert.deepStrictEqual(starts, [])
})

test('getPitcherStartsInRange handles a missing/empty probablesData gracefully', () => {
  assert.deepStrictEqual(getPitcherStartsInRange(null, { pitcherId: 'x' }, '2026-08-01', '2026-08-15'), [])
  assert.deepStrictEqual(getPitcherStartsInRange({}, { pitcherId: 'x' }, '2026-08-01', '2026-08-15'), [])
})

test('hasFullCoverage true when the scraped window fully contains the week', () => {
  assert.strictEqual(hasFullCoverage(SAMPLE, '2026-08-05', '2026-08-11'), true)
})

test('hasFullCoverage false when the week extends past the scraped window', () => {
  assert.strictEqual(hasFullCoverage(SAMPLE, '2026-08-12', '2026-08-18'), false)
})

test('hasFullCoverage false when probablesData has no date_range', () => {
  assert.strictEqual(hasFullCoverage({}, '2026-08-05', '2026-08-11'), false)
  assert.strictEqual(hasFullCoverage(null, '2026-08-05', '2026-08-11'), false)
})

test('isProbablesDataUsable false when stale', () => {
  assert.strictEqual(isProbablesDataUsable({ ...SAMPLE, stale: true }), false)
})

test('isProbablesDataUsable true when fresh', () => {
  assert.strictEqual(isProbablesDataUsable(SAMPLE), true)
})

test('isProbablesDataUsable false when missing entirely', () => {
  assert.strictEqual(isProbablesDataUsable(null), false)
  assert.strictEqual(isProbablesDataUsable(undefined), false)
})

test('normalizePitcherName strips accents, suffixes, and parenthetical Yahoo-style position tags', () => {
  assert.strictEqual(normalizePitcherName('Walbert Ureña'), 'walbert urena')
  assert.strictEqual(normalizePitcherName('Cristopher Sánchez Jr.'), 'cristopher sanchez')
  assert.strictEqual(normalizePitcherName('Shohei Ohtani (Pitcher)'), 'shohei ohtani')
})

if (failures.length > 0) {
  console.error(`\nprobables.test.js — ${passed} passed, ${failures.length} failed\n`)
  for (const { name, err } of failures) {
    console.error(`  FAIL  ${name}`)
    console.error(`        ${err.message}`)
  }
  process.exit(1)
} else {
  console.log(`probables.test.js — ${passed} passed`)
}
