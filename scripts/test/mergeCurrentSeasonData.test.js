#!/usr/bin/env node
'use strict'

// Plain Node test runner (no framework in this project) — run with:
//   node scripts/test/mergeCurrentSeasonData.test.js

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { mergeCurrentSeasonData, validateBatchShape, validatePlayerEntry } = require('../mergeCurrentSeasonData')

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

function makePlayer(overrides = {}) {
  return {
    id: 'nikola-jokic',
    name: 'Nikola Jokic',
    team: 'DEN',
    positions: ['C'],
    yahoo_positions: ['C'],
    adp: 1.3,
    adp_source: 'FantasyPros Yahoo 10-team 2026',
    prior_season: { pts: 27.7, reb: 12.9, ast: 10.7, stl: 1.4, blk: 0.8, to: 3.7, fg_pct: 0.569, ft_pct: 0.831, three_pm: 1.7, gp: 65 },
    current_season: null,
    age: 30,
    injury_risk: false,
    injury_notes: null,
    injury_status: 'healthy',
    contract_year: false,
    notes: null,
    ...overrides,
  }
}

function validIncomingEntry(overrides = {}) {
  const { current_season, ...topLevel } = overrides
  return {
    id: 'nikola-jokic',
    current_season: {
      pts: 26.8, reb: 12.5, ast: 10.9, stl: 1.2, blk: 0.7, to: 3.5,
      fg_pct: 0.558, ft_pct: 0.819, three_pm: 1.5, gp: 14,
      ...current_season,
    },
    ...topLevel,
  }
}

// ─── validateBatchShape ──────────────────────────────────────────────────────

test('validateBatchShape: valid batch has no errors', () => {
  const errors = validateBatchShape({ as_of_date: '2026-06-30', players: [] })
  assert.deepStrictEqual(errors, [])
})

test('validateBatchShape: rejects missing as_of_date', () => {
  const errors = validateBatchShape({ players: [] })
  assert.ok(errors.some(e => e.includes('as_of_date')))
})

test('validateBatchShape: rejects non-array players', () => {
  const errors = validateBatchShape({ as_of_date: '2026-06-30', players: 'nope' })
  assert.ok(errors.some(e => e.includes('players')))
})

test('validateBatchShape: rejects non-object root', () => {
  const errors = validateBatchShape(null)
  assert.ok(errors.length > 0)
})

// ─── validatePlayerEntry ─────────────────────────────────────────────────────

test('validatePlayerEntry: valid entry has no errors', () => {
  assert.deepStrictEqual(validatePlayerEntry(validIncomingEntry()), [])
})

test('validatePlayerEntry: flags missing required stat field', () => {
  const entry = validIncomingEntry()
  delete entry.current_season.reb
  const errors = validatePlayerEntry(entry)
  assert.ok(errors.some(e => e.includes('reb')))
})

test('validatePlayerEntry: flags non-numeric stat field', () => {
  const errors = validatePlayerEntry(validIncomingEntry({ current_season: { pts: 'a lot' } }))
  assert.ok(errors.some(e => e.includes('pts')))
})

test('validatePlayerEntry: sport="nba" (explicit) validates the full stat set, not just the first field', () => {
  // Regression guard: SPORT_SCHEMAS.nba is a flat array. getRequiredFields()
  // must return it as-is (Array.isArray check) rather than treating it like
  // the multi-position-type schemas (nhl/nfl/mlb) and returning just the
  // first array element as a bare string.
  const errors = validatePlayerEntry(validIncomingEntry(), 'nba')
  assert.deepStrictEqual(errors, [])

  const missingAst = validIncomingEntry()
  delete missingAst.current_season.ast
  const missingAstErrors = validatePlayerEntry(missingAst, 'nba')
  assert.ok(missingAstErrors.some(e => e.includes('ast')))
})

test('validatePlayerEntry: flags invalid injury_status', () => {
  const errors = validatePlayerEntry(validIncomingEntry({ current_season: { injury_status: 'maybe' } }))
  assert.ok(errors.some(e => e.includes('injury_status')))
})

function makeNflPlayer(overrides = {}) {
  return {
    id: 'bijan-robinson',
    name: 'Bijan Robinson',
    team: 'ATL',
    positions: ['RB'],
    yahoo_positions: ['RB'],
    adp: 1.3,
    adp_source: 'FantasyPros Consensus 2026 NFL',
    prior_season: { pass_yd: null, pass_td: null, int: null, rush_yd: 1478, rush_td: 7, rec: 79, rec_yd: 820, rec_td: 4, gp: 17, fantasy_ppg: 19.72 },
    current_season: null,
    age: 23,
    injury_risk: false,
    injury_notes: null,
    injury_status: 'healthy',
    contract_year: false,
    notes: null,
    ...overrides,
  }
}

function validNflRbEntry(overrides = {}) {
  const { current_season, ...topLevel } = overrides
  return {
    id: 'bijan-robinson',
    current_season: {
      position_type: 'RB', rush_yd: 1478, rush_td: 7, rec_yd: 820, rec_td: 4, rec: 79, gp: 17, fantasy_ppg: 19.49,
      ...current_season,
    },
    ...topLevel,
  }
}

// ─── NFL schema (regression guard — see mergeCurrentSeasonData.js SPORT_SCHEMAS.nfl) ──

test('validatePlayerEntry: sport="nfl"/positionType="RB" — valid entry has no errors', () => {
  const errors = validatePlayerEntry(validNflRbEntry(), 'nfl', 'RB')
  assert.deepStrictEqual(errors, [])
})

test('validatePlayerEntry: sport="nfl"/positionType="RB" — flags missing rec_yd', () => {
  const entry = validNflRbEntry()
  delete entry.current_season.rec_yd
  const errors = validatePlayerEntry(entry, 'nfl', 'RB')
  assert.ok(errors.some(e => e.includes('rec_yd')))
})

test('validatePlayerEntry: sport="nfl"/positionType="QB" — requires "pass_yd", not the old "pass_yds"', () => {
  // Regression guard: SPORT_SCHEMAS.nfl.QB originally listed pass_yds/g,
  // which never matched what scrape_nfl.py/seasonStats.js/prior_season
  // actually use (pass_yd/gp) — current_season validated against field
  // names nothing ever produced, so real NFL stats silently never landed.
  const entry = {
    id: 'josh-allen',
    current_season: { position_type: 'QB', pass_yds: 3668, pass_td: 25, int: 10, rush_yd: 579, rush_td: 14, gp: 17, fantasy_ppg: 22.04 },
  }
  const errors = validatePlayerEntry(entry, 'nfl', 'QB')
  assert.ok(errors.some(e => e.includes('pass_yd')))
})

test('mergeCurrentSeasonData: nfl entry uses the single fantasy_ppg trend signal, not nba pts/reb/ast', () => {
  const players = [makeNflPlayer()]
  const incoming = { as_of_date: '2026-09-15', sport: 'nfl', players: [validNflRbEntry()] }
  const result = mergeCurrentSeasonData(incoming, players)

  assert.strictEqual(result.ok, true)
  const updated = result.players.find(p => p.id === 'bijan-robinson')
  assert.strictEqual(updated.current_season.position_type, 'RB')
  assert.strictEqual(updated.current_season.fantasy_ppg, 19.49)
  assert.strictEqual(updated.current_season.trend, 'stable') // matches real 2025 sample data
})

test('mergeCurrentSeasonData: nfl trend reacts to a real fantasy_ppg swing', () => {
  const players = [makeNflPlayer({
    prior_season: { pass_yd: null, pass_td: null, int: null, rush_yd: 1000, rush_td: 5, rec: 50, rec_yd: 400, rec_td: 2, gp: 17, fantasy_ppg: 12 },
  })]
  const incoming = { as_of_date: '2026-09-15', sport: 'nfl', players: [validNflRbEntry({ current_season: { fantasy_ppg: 16 } })] } // +33%
  const result = mergeCurrentSeasonData(incoming, players)
  const updated = result.players.find(p => p.id === 'bijan-robinson')
  assert.strictEqual(updated.current_season.trend, 'improving')
})

// ─── mergeCurrentSeasonData: batch-level rejection ───────────────────────────

test('rejects malformed batch entirely — no players touched', () => {
  const players = [makePlayer()]
  const result = mergeCurrentSeasonData({ players: 'not-an-array' }, players)
  assert.strictEqual(result.ok, false)
  assert.ok(result.batchErrors.length > 0)
  assert.strictEqual(result.players, players) // untouched, same reference
})

// ─── mergeCurrentSeasonData: matching ────────────────────────────────────────

test('updates current_season for a matched player', () => {
  const players = [makePlayer()]
  const incoming = { as_of_date: '2026-06-30', players: [validIncomingEntry()] }
  const result = mergeCurrentSeasonData(incoming, players)

  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual(result.updated, ['nikola-jokic'])

  const updatedPlayer = result.players.find(p => p.id === 'nikola-jokic')
  assert.strictEqual(updatedPlayer.current_season.as_of_date, '2026-06-30')
  assert.strictEqual(updatedPlayer.current_season.pts, 26.8)
  assert.strictEqual(updatedPlayer.current_season.source, 'hermes_weekly_pull')
  assert.strictEqual(updatedPlayer.current_season.trend, 'stable') // matches real sample data
})

test('skips unmatched id with a warning, does not crash or fail the batch', () => {
  const players = [makePlayer()]
  const incoming = { as_of_date: '2026-06-30', players: [validIncomingEntry({ id: 'does-not-exist' })] }
  const result = mergeCurrentSeasonData(incoming, players)

  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual(result.skipped, ['does-not-exist'])
  assert.deepStrictEqual(result.updated, [])
  assert.strictEqual(result.players.length, 1)
})

test('malformed entry is rejected and reported, does not block the rest of the batch', () => {
  const players = [makePlayer()]
  const malformed = validIncomingEntry()
  delete malformed.current_season.pts
  const incoming = { as_of_date: '2026-06-30', players: [malformed] }
  const result = mergeCurrentSeasonData(incoming, players)

  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.invalid.length, 1)
  assert.strictEqual(result.invalid[0].id, 'nikola-jokic')
  assert.ok(result.invalid[0].errors.some(e => e.includes('pts')))
  assert.deepStrictEqual(result.updated, [])
})

test('combined run: valid + unmatched + malformed entries all handled correctly together', () => {
  const players = [makePlayer(), makePlayer({ id: 'luka-doncic', name: 'Luka Doncic' })]
  const malformed = validIncomingEntry({ id: 'luka-doncic' })
  delete malformed.current_season.gp

  const incoming = {
    as_of_date: '2026-06-30',
    players: [
      validIncomingEntry({ id: 'nikola-jokic' }),
      validIncomingEntry({ id: 'unknown-player' }),
      malformed,
    ],
  }
  const result = mergeCurrentSeasonData(incoming, players)

  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual(result.updated, ['nikola-jokic'])
  assert.deepStrictEqual(result.skipped, ['unknown-player'])
  assert.strictEqual(result.invalid.length, 1)
  assert.strictEqual(result.invalid[0].id, 'luka-doncic')
})

// ─── Critical safety: only current_season is ever touched ───────────────────

test('field isolation: no field other than current_season is modified on update', () => {
  const original = makePlayer()
  const players = [original]
  const incoming = { as_of_date: '2026-06-30', players: [validIncomingEntry()] }
  const result = mergeCurrentSeasonData(incoming, players)
  const updatedPlayer = result.players.find(p => p.id === 'nikola-jokic')

  for (const key of Object.keys(original)) {
    if (key === 'current_season') continue
    assert.deepStrictEqual(updatedPlayer[key], original[key], `field "${key}" was modified`)
  }
})

test('field isolation: original input array/objects are never mutated', () => {
  const original = makePlayer()
  const originalSnapshot = JSON.parse(JSON.stringify(original))
  const players = [original]
  const incoming = { as_of_date: '2026-06-30', players: [validIncomingEntry()] }
  mergeCurrentSeasonData(incoming, players)

  assert.deepStrictEqual(original, originalSnapshot)
})

test('injury_status/injury_note carry forward when omitted from incoming entry', () => {
  const players = [makePlayer({
    current_season: { as_of_date: '2026-06-20', pts: 25, reb: 12, ast: 10, stl: 1, blk: 1, to: 3, fg_pct: 0.5, ft_pct: 0.8, three_pm: 1, gp: 10, trend: 'stable', injury_status: 'day-to-day', injury_note: 'Sore ankle', source: 'hermes_weekly_pull', note: null },
  })]
  const incoming = { as_of_date: '2026-06-30', players: [validIncomingEntry()] } // no injury_status in this pull
  const result = mergeCurrentSeasonData(incoming, players)
  const updatedPlayer = result.players.find(p => p.id === 'nikola-jokic')

  assert.strictEqual(updatedPlayer.current_season.injury_status, 'day-to-day')
  assert.strictEqual(updatedPlayer.current_season.injury_note, 'Sore ankle')
})

// ─── CLI integration ──────────────────────────────────────────────────────

test('CLI: runs end-to-end against temp files, writes only current_season', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pocketbeane-merge-test-'))
  try {
    const playersFile = path.join(tmpDir, 'players.json')
    const inputFile = path.join(tmpDir, 'incoming.json')

    const players = [makePlayer(), makePlayer({ id: 'luka-doncic', name: 'Luka Doncic' })]
    fs.writeFileSync(playersFile, JSON.stringify(players, null, 2))
    fs.writeFileSync(inputFile, JSON.stringify({
      as_of_date: '2026-06-30',
      players: [validIncomingEntry({ id: 'nikola-jokic' }), validIncomingEntry({ id: 'someone-else' })],
    }, null, 2))

    const scriptPath = path.resolve(__dirname, '..', 'mergeCurrentSeasonData.js')
    const output = execFileSync('node', [scriptPath, inputFile, '--players', playersFile], { encoding: 'utf-8' })

    assert.ok(output.includes('Updated:  1'))
    assert.ok(output.includes('Skipped:  1'))

    const written = JSON.parse(fs.readFileSync(playersFile, 'utf-8'))
    const jokic = written.find(p => p.id === 'nikola-jokic')
    const luka = written.find(p => p.id === 'luka-doncic')

    assert.strictEqual(jokic.current_season.pts, 26.8)
    assert.deepStrictEqual(luka.current_season, null) // untouched
    assert.deepStrictEqual(luka.prior_season, players[1].prior_season) // untouched
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('CLI: exits non-zero and writes nothing when batch shape is malformed', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pocketbeane-merge-test-'))
  try {
    const playersFile = path.join(tmpDir, 'players.json')
    const inputFile = path.join(tmpDir, 'incoming.json')

    const players = [makePlayer()]
    fs.writeFileSync(playersFile, JSON.stringify(players, null, 2))
    fs.writeFileSync(inputFile, JSON.stringify({ players: [] })) // missing as_of_date

    const scriptPath = path.resolve(__dirname, '..', 'mergeCurrentSeasonData.js')
    let threw = false
    try {
      execFileSync('node', [scriptPath, inputFile, '--players', playersFile], { encoding: 'utf-8' })
    } catch (err) {
      threw = true
      assert.notStrictEqual(err.status, 0)
    }
    assert.ok(threw, 'expected the CLI to exit non-zero')

    const untouched = JSON.parse(fs.readFileSync(playersFile, 'utf-8'))
    assert.deepStrictEqual(untouched, players)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

if (failures.length > 0) {
  console.error(`\nmergeCurrentSeasonData.test.js — ${passed} passed, ${failures.length} failed\n`)
  for (const { name, err } of failures) {
    console.error(`  FAIL  ${name}`)
    console.error(`        ${err.message}`)
  }
  process.exit(1)
} else {
  console.log(`mergeCurrentSeasonData.test.js — ${passed} passed`)
}
