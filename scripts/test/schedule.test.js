#!/usr/bin/env node
'use strict'

// Plain Node test runner (no framework in this project) — run with:
//   node scripts/test/schedule.test.js

const assert = require('assert')
const {
  getTeamGamesInRange,
  countGamesInRange,
  findBackToBacks,
  hasBackToBack,
  getWeekRange,
} = require('../../src/utils/schedule')

const nbaSchedule = require('../../src/data/nba_schedule.json')

// Inline fixture (not the live src/data/mlb_schedule.json) — that file now
// holds the real full MLB season fetched via scripts/fetch_mlb_schedule.py,
// so asserting specific values against it would break every time the real
// schedule refreshes. Same fix should apply to the NBA block above once
// nba_schedule.json is replaced with a real fetch instead of its manual seed.
const mlbSchedule = {
  season: '2026',
  sport: 'mlb',
  source: 'test_fixture',
  games: [
    { date: '2026-07-06', home: 'NYY', away: 'LAD' },
    { date: '2026-07-07', home: 'NYY', away: 'LAD' },
    { date: '2026-07-08', home: 'NYY', away: 'LAD' },
    { date: '2026-07-10', home: 'LAD', away: 'BOS' },
    { date: '2026-07-11', home: 'LAD', away: 'BOS' },
    { date: '2026-07-12', home: 'LAD', away: 'BOS' },
  ],
}

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

// ─── NBA seed data: week 1 = 2026-11-16..22, week 2 = 2026-11-23..29 ───────

test('DEN has 4 games in NBA week 1', () => {
  const games = getTeamGamesInRange(nbaSchedule, 'DEN', '2026-11-16', '2026-11-22')
  assert.deepStrictEqual(games, ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-22'])
})

test('DEN has 1 game in NBA week 2', () => {
  const games = getTeamGamesInRange(nbaSchedule, 'DEN', '2026-11-23', '2026-11-29')
  assert.deepStrictEqual(games, ['2026-11-25'])
})

test('a team absent from the schedule file entirely returns an empty array', () => {
  const games = getTeamGamesInRange(nbaSchedule, 'CHA', '2026-11-16', '2026-11-22')
  assert.deepStrictEqual(games, [])
})

test('countGamesInRange matches getTeamGamesInRange length', () => {
  const count = countGamesInRange(nbaSchedule, 'MIA', '2026-11-16', '2026-11-22')
  const games = getTeamGamesInRange(nbaSchedule, 'MIA', '2026-11-16', '2026-11-22')
  assert.strictEqual(count, games.length)
})

test('MIA has a back-to-back in NBA week 1 (11/17 -> 11/18)', () => {
  const games = getTeamGamesInRange(nbaSchedule, 'MIA', '2026-11-16', '2026-11-22')
  assert.strictEqual(hasBackToBack(games), true)
  assert.deepStrictEqual(findBackToBacks(games), [['2026-11-17', '2026-11-18']])
})

test('DEN has no back-to-back in NBA week 1 (every gap is 2+ days)', () => {
  const games = getTeamGamesInRange(nbaSchedule, 'DEN', '2026-11-16', '2026-11-22')
  assert.strictEqual(hasBackToBack(games), false)
})

test('BOS has a back-to-back in NBA week 2 (11/23 -> 11/24)', () => {
  const games = getTeamGamesInRange(nbaSchedule, 'BOS', '2026-11-23', '2026-11-29')
  assert.strictEqual(hasBackToBack(games), true)
})

// ─── MLB seed data: week of 2026-07-06..12 (matches real current_season data) ─

test('LAD has 6 games in MLB seed week (two 3-game series)', () => {
  const games = getTeamGamesInRange(mlbSchedule, 'LAD', '2026-07-06', '2026-07-12')
  assert.strictEqual(games.length, 6)
})

test('NYY has 3 games in MLB seed week (one series only)', () => {
  const games = getTeamGamesInRange(mlbSchedule, 'NYY', '2026-07-06', '2026-07-12')
  assert.deepStrictEqual(games, ['2026-07-06', '2026-07-07', '2026-07-08'])
})

test('a team with no seeded games (e.g. TEX) returns an empty array', () => {
  const games = getTeamGamesInRange(mlbSchedule, 'TEX', '2026-07-06', '2026-07-12')
  assert.deepStrictEqual(games, [])
})

// ─── getWeekRange ───────────────────────────────────────────────────────────

test('getWeekRange resolves a mid-week anchor to that week\'s Monday/Sunday', () => {
  assert.deepStrictEqual(getWeekRange('2026-11-18'), { start: '2026-11-16', end: '2026-11-22' })
})

test('getWeekRange with a Monday anchor returns the same week', () => {
  assert.deepStrictEqual(getWeekRange('2026-11-16'), { start: '2026-11-16', end: '2026-11-22' })
})

test('getWeekRange with a Sunday anchor returns the same week', () => {
  assert.deepStrictEqual(getWeekRange('2026-11-22'), { start: '2026-11-16', end: '2026-11-22' })
})

// ─── Purity ─────────────────────────────────────────────────────────────────

test('getTeamGamesInRange does not mutate its inputs', () => {
  const scheduleCopy = JSON.parse(JSON.stringify(nbaSchedule))
  getTeamGamesInRange(nbaSchedule, 'DEN', '2026-11-16', '2026-11-22')
  assert.deepStrictEqual(nbaSchedule, scheduleCopy)
})

test('findBackToBacks does not mutate its input array', () => {
  const dates = ['2026-11-17', '2026-11-18']
  const datesCopy = [...dates]
  findBackToBacks(dates)
  assert.deepStrictEqual(dates, datesCopy)
})

if (failures.length > 0) {
  console.error(`\nschedule.test.js — ${passed} passed, ${failures.length} failed\n`)
  for (const { name, err } of failures) {
    console.error(`  FAIL  ${name}`)
    console.error(`        ${err.message}`)
  }
  process.exit(1)
} else {
  console.log(`schedule.test.js — ${passed} passed`)
}
