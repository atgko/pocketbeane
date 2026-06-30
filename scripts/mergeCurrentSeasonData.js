#!/usr/bin/env node
'use strict'

/**
 * mergeCurrentSeasonData.js — T1-2
 *
 * Safely merges an incoming current-season stat snapshot into players.json.
 * Only ever writes the `current_season` field — every other field (prior_season,
 * adp, injury_risk, top-level injury_status, etc.) is left exactly as-is.
 *
 * Usage:
 *   node scripts/mergeCurrentSeasonData.js path/to/incoming-data.json
 *   node scripts/mergeCurrentSeasonData.js path/to/incoming-data.json --players ./src/data/players.json
 *
 * Input file shape:
 *   {
 *     "as_of_date": "2026-11-15",
 *     "players": [
 *       { "id": "nikola-jokic", "pts": 27.1, "reb": 13.2, "ast": 9.8, "stl": 1.1,
 *         "blk": 0.7, "to": 3.2, "fg_pct": 0.561, "ft_pct": 0.812, "three_pm": 1.6, "gp": 18 }
 *     ]
 *   }
 *
 * Behaviour:
 *   - Validates the batch shape (top-level as_of_date + players array) before
 *     touching disk. If that fails, nothing is written.
 *   - Validates each player entry independently. Malformed entries are skipped
 *     and reported; they do not block the rest of the batch.
 *   - Matches players by `id`. Unmatched ids are skipped and reported; they do
 *     not fail the batch either.
 *   - injury_status / injury_note are optional per-entry overrides — if omitted,
 *     the player's existing current_season values (if any) carry forward instead
 *     of being reset to "healthy", so a stats-only weekly pull can't silently
 *     erase known injury info.
 */

const fs = require('fs')
const path = require('path')
const { calculateTrend } = require('./calculateTrend')

const REQUIRED_STAT_FIELDS = ['pts', 'reb', 'ast', 'stl', 'blk', 'to', 'fg_pct', 'ft_pct', 'three_pm', 'gp']
const VALID_INJURY_STATUSES = ['healthy', 'day-to-day', 'out']
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SOURCE = 'hermes_weekly_pull'

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isValidISODate(v) {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) return false
  return !isNaN(new Date(v).getTime())
}

// Validates top-level batch shape only — does not look at individual players.
function validateBatchShape(data) {
  const errors = []
  if (!isPlainObject(data)) {
    errors.push('input root must be a JSON object')
    return errors
  }
  if (!isValidISODate(data.as_of_date)) {
    errors.push('missing or invalid top-level "as_of_date" (expected ISO date string, e.g. "2026-11-15")')
  }
  if (!Array.isArray(data.players)) {
    errors.push('missing or invalid "players" (expected array)')
  }
  return errors
}

// Validates a single incoming player entry. Returns an array of error strings (empty = valid).
function validatePlayerEntry(entry) {
  if (!isPlainObject(entry)) return ['entry is not an object']

  const errors = []
  if (typeof entry.id !== 'string' || !entry.id.trim()) {
    errors.push('missing or invalid "id"')
  }
  for (const field of REQUIRED_STAT_FIELDS) {
    if (typeof entry[field] !== 'number' || Number.isNaN(entry[field])) {
      errors.push(`missing or non-numeric "${field}"`)
    }
  }
  if (entry.injury_status !== undefined && !VALID_INJURY_STATUSES.includes(entry.injury_status)) {
    errors.push(`invalid "injury_status" (must be one of: ${VALID_INJURY_STATUSES.join(', ')})`)
  }
  if (entry.injury_note !== undefined && entry.injury_note !== null && typeof entry.injury_note !== 'string') {
    errors.push('invalid "injury_note" (must be string or null)')
  }
  return errors
}

// mergeCurrentSeasonData(incomingData, existingPlayers) -> {
//   ok, batchErrors, updated, skipped, invalid, players
// }
// Pure with respect to its inputs — does not touch disk. existingPlayers is never
// mutated; a shallow-copied array is returned with only current_season replaced
// on matched players.
function mergeCurrentSeasonData(incomingData, existingPlayers) {
  const batchErrors = validateBatchShape(incomingData)
  if (batchErrors.length > 0) {
    return { ok: false, batchErrors, updated: [], skipped: [], invalid: [], players: existingPlayers }
  }

  const nextPlayers = existingPlayers.map(p => ({ ...p }))
  const nextById = new Map(nextPlayers.map(p => [p.id, p]))

  const updated = []
  const skipped = []
  const invalid = []

  for (const entry of incomingData.players) {
    const entryErrors = validatePlayerEntry(entry)
    if (entryErrors.length > 0) {
      invalid.push({ id: isPlainObject(entry) ? entry.id : undefined, errors: entryErrors })
      continue
    }

    const existing = nextById.get(entry.id)
    if (!existing) {
      skipped.push(entry.id)
      continue
    }

    const incomingStats = {}
    for (const field of REQUIRED_STAT_FIELDS) incomingStats[field] = entry[field]

    const trend = calculateTrend(existing.prior_season ?? null, incomingStats)

    const previousCurrentSeason = existing.current_season ?? null
    const injuryStatus = entry.injury_status ?? previousCurrentSeason?.injury_status ?? 'healthy'
    const injuryNote = entry.injury_status !== undefined
      ? (entry.injury_note ?? null)
      : (previousCurrentSeason?.injury_note ?? null)

    existing.current_season = {
      as_of_date: incomingData.as_of_date,
      ...incomingStats,
      trend,
      injury_status: injuryStatus,
      injury_note: injuryNote,
      source: SOURCE,
      note: null,
    }

    updated.push(entry.id)
  }

  return { ok: true, batchErrors: [], updated, skipped, invalid, players: nextPlayers }
}

module.exports = {
  mergeCurrentSeasonData,
  validateBatchShape,
  validatePlayerEntry,
  REQUIRED_STAT_FIELDS,
  VALID_INJURY_STATUSES,
}

// ─── CLI ───────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2)
  const inputFile = args[0]

  const flags = {}
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const next = args[i + 1]
      flags[key] = next && !next.startsWith('--') ? (i++, next) : true
    }
  }

  if (!inputFile) {
    console.error([
      '',
      '  Usage: node scripts/mergeCurrentSeasonData.js path/to/incoming-data.json',
      '',
      '  --players  Path to players.json (default: ./src/data/players.json)',
      '',
    ].join('\n'))
    process.exit(1)
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`)
    process.exit(1)
  }

  const playersFile = flags.players || path.resolve(__dirname, '..', 'src', 'data', 'players.json')

  let incomingData
  try {
    incomingData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'))
  } catch (err) {
    console.error(`Failed to parse input file as JSON: ${err.message}`)
    process.exit(1)
  }

  let existingPlayers
  try {
    existingPlayers = JSON.parse(fs.readFileSync(playersFile, 'utf-8'))
  } catch (err) {
    console.error(`Failed to parse players file as JSON: ${err.message}`)
    process.exit(1)
  }

  const result = mergeCurrentSeasonData(incomingData, existingPlayers)

  if (!result.ok) {
    console.error('\nInput validation failed — no changes written:')
    result.batchErrors.forEach(e => console.error(`  - ${e}`))
    process.exit(1)
  }

  fs.writeFileSync(playersFile, JSON.stringify(result.players, null, 2) + '\n')

  console.log(`
─────────────────────────────────────────
  Done.

  ✓ Updated:  ${result.updated.length} players
  ⚠ Skipped:  ${result.skipped.length} players (no match in players.json)
  ✗ Invalid:  ${result.invalid.length} entries (validation errors — not written)

  Output: ${playersFile}
─────────────────────────────────────────${result.skipped.length ? `

Skipped (no match):
${result.skipped.map(id => `  - ${id}`).join('\n')}` : ''}${result.invalid.length ? `

Invalid entries (not written):
${result.invalid.map(e => `  - ${e.id ?? '(missing id)'}: ${e.errors.join('; ')}`).join('\n')}` : ''}
`)
}
