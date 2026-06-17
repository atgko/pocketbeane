#!/usr/bin/env node
'use strict'

/**
 * build-players.js
 *
 * Merges a FantasyPros ADP CSV and a Basketball Reference per-game stats CSV
 * into players.json for PocketBeane.
 *
 * Usage:
 *   node scripts/build-players.js --adp <file> --stats <file>
 *   node scripts/build-players.js --adp <file> --stats <file> --apply-fixes
 *   node scripts/build-players.js --adp <file> --stats <file> --output ./src/data/players.json
 *
 * Flags:
 *   --adp          Path to FantasyPros ADP CSV (required)
 *   --stats        Path to Basketball Reference per-game stats CSV (required)
 *   --apply-fixes  Read scripts/review.json and apply manual name mappings before matching
 *   --output       Output path for players.json (default: ./src/data/players.json)
 *   --review       Output path for review.json (default: ./scripts/review.json)
 *   --source       ADP source label string (default: "FantasyPros Yahoo 10-team 2026")
 *   --top          How many players to include (default: 200)
 *
 * Output files:
 *   players.json — merged player records, sorted by ADP
 *   review.json  — players that need manual name resolution
 */

const fs = require('fs')
const path = require('path')

// ─── CLI flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flags = {}
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2)
    const next = args[i + 1]
    flags[key] = next && !next.startsWith('--') ? (i++, next) : true
  }
}

const ADP_FILE     = flags.adp
const STATS_FILE   = flags.stats
const APPLY_FIXES  = flags['apply-fixes'] === true
const OUTPUT_FILE  = flags.output  || path.resolve(__dirname, '..', 'src', 'data', 'players.json')
const REVIEW_FILE  = flags.review  || path.resolve(__dirname, 'review.json')
const ADP_SOURCE   = flags.source  || 'FantasyPros Yahoo 10-team 2026'
const TOP_N        = parseInt(flags.top || '200', 10)
const FUZZY_THRESHOLD = 0.75 // Dice coefficient — below this goes to review.json

if (!ADP_FILE || !STATS_FILE) {
  console.error([
    '',
    '  Usage: node scripts/build-players.js --adp <file> --stats <file>',
    '',
    '  --adp    FantasyPros ADP CSV export (required)',
    '  --stats  Basketball Reference per-game stats CSV (required)',
    '  --apply-fixes  Apply manual fixes from review.json before matching',
    '',
  ].join('\n'))
  process.exit(1)
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function normalizeName(raw) {
  return String(raw)
    .normalize('NFD')                        // decompose accented chars (é → e + combining mark)
    .replace(/[̀-ͯ]/g, '')         // strip combining diacritical marks
    .replace(/\?/g, '')                      // BBRef encoding artifact for accented chars (č → ?)
    .toLowerCase()
    .replace(/\./g, '')                      // "P.J." → "PJ"
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')  // strip suffixes
    .replace(/[^a-z\s'-]/g, '')             // keep letters, spaces, hyphens, apostrophes
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(name) {
  return normalizeName(name)
    .replace(/['\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Sørensen–Dice coefficient — bigram overlap between two strings
function dice(a, b) {
  a = normalizeName(a)
  b = normalizeName(b)
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigrams = new Map()
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2)
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1)
  }
  let overlap = 0
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2)
    const count = bigrams.get(bg) ?? 0
    if (count > 0) {
      bigrams.set(bg, count - 1)
      overlap++
    }
  }
  return (2 * overlap) / (a.length + b.length - 2)
}

// Search a row object for a value by trying multiple candidate column names.
// Comparison is case-insensitive after stripping punctuation.
function col(row, ...candidates) {
  const keys = Object.keys(row)
  for (const c of candidates) {
    const cNorm = c.toLowerCase().replace(/[^a-z0-9%]/g, '')
    const key = keys.find(k => k.toLowerCase().replace(/[^a-z0-9%]/g, '') === cNorm)
    if (key !== undefined && row[key] !== '' && row[key] !== undefined) return row[key]
  }
  return null
}

// Parse CSV — handles quoted fields, Windows/Unix line endings.
// Also handles BBRef's "Share & Export" format where every row is wrapped in outer
// double-quotes: `"Rk,Player,Age,..."` — detected automatically and unwrapped.
function parseCSV(filePath) {
  let raw = fs.readFileSync(filePath, 'utf-8')
    .replace(/^﻿/, '')      // strip BOM if present
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  // BBRef "Share & Export" detection: each row is one outer-quoted string whose
  // inner content uses bare commas (no per-field quoting). A normal CSV that starts
  // and ends with `"` will have `","` field boundaries inside — BBRef rows won't.
  const allLines = raw.split('\n')
  const firstContent = allLines.find(l => l.trim() && !l.includes('---') && !l.includes('SR data'))
  if (firstContent) {
    const t = firstContent.trim()
    const inner = t.slice(1, -1)
    const isBBRefWrapped = t.startsWith('"') && t.endsWith('"') && inner.includes(',') && !inner.includes('","')
    if (isBBRefWrapped) {
      raw = allLines
        .filter(l => l.trim() && !l.includes('---') && !l.includes('SR data'))
        .map(l => {
          const trimmed = l.trim()
          return (trimmed.startsWith('"') && trimmed.endsWith('"'))
            ? trimmed.slice(1, -1)
            : l
        })
        .join('\n')
    }
  }

  const lines = raw.split('\n').filter(l => l.trim())

  function parseLine(line) {
    const fields = []
    let inQuotes = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = parseLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i])
    if (vals.every(v => !v)) continue
    const row = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })
    rows.push(row)
  }
  return rows
}

// Derives a baseline auction dollar value from ADP using a log-linear model calibrated
// for a standard 10-team, $200 budget, 13-roster-spot league.
// Replace with real FantasyPros auction CSV data when available each season.
//   adp=1   → $70  (top overall pick)
//   adp=10  → $37
//   adp=50  → $15
//   adp=130 → $1   (last rostered player in 10×13 league)
//   adp>130 → $1   (effectively undrafted)
const AUCTION_A = 70
const AUCTION_B = 69 / Math.log(130)  // calibrated so adp=130 → $1

function deriveAuctionValue(adp) {
  const raw = AUCTION_A - AUCTION_B * Math.log(Math.max(1, adp))
  return Math.max(1, Math.round(raw))
}

// Parse numeric — return null for empty/missing, float otherwise
function parseNum(val, decimals = 1) {
  if (val === null || val === undefined || val === '' || val === 'N/A') return null
  const n = parseFloat(String(val).replace(/,/g, ''))
  if (isNaN(n)) return null
  return parseFloat(n.toFixed(decimals))
}

// Normalize position strings from FantasyPros: "PG,SF" or "PG/SF" → ["PG", "SF"]
function parsePositions(raw) {
  if (!raw) return []
  return String(raw)
    .split(/[,/|]/)
    .map(p => p.trim().toUpperCase())
    .filter(Boolean)
    .filter(p => ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'].includes(p))
}

// ─── Load aliases (FP name → BBRef name) ─────────────────────────────────────

const ALIASES_FILE = path.resolve(__dirname, 'aliases.js')
const aliases = fs.existsSync(ALIASES_FILE) ? require('./aliases.js') : {}
// Normalize alias keys for lookup
const normalizedAliases = {}
for (const [fpName, bbrefName] of Object.entries(aliases)) {
  normalizedAliases[normalizeName(fpName)] = bbrefName
}

// ─── Load review.json fixes ───────────────────────────────────────────────────

const fixes = {} // normalizedFpName → { bbrefName, skip }
if (APPLY_FIXES) {
  if (!fs.existsSync(REVIEW_FILE)) {
    console.error(`--apply-fixes: review.json not found at ${REVIEW_FILE}`)
    process.exit(1)
  }
  const reviewData = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf-8'))
  for (const entry of reviewData) {
    if (!entry.fpName) continue
    const key = normalizeName(entry.fpName)
    if (entry.action === 'skip') {
      fixes[key] = { skip: true }
    } else if (entry.action === 'match' && entry.bbrefName) {
      fixes[key] = { bbrefName: entry.bbrefName }
    }
  }
  console.log(`Loaded ${Object.keys(fixes).length} manual fixes from review.json`)
}

// ─── Parse FantasyPros ADP CSV ────────────────────────────────────────────────
//
// FantasyPros draft rankings embed team, positions, and injury status inside the
// player name field: "Luka Doncic (LAL - PG,SG) DTD". The TEAM column is often
// blank. This regex extracts all three pieces from the name field.
const FP_NAME_RE = /^(.*?)\s*\(([A-Z]{2,3})\s*-\s*([^)]+)\)\s*(DTD|OUT|QUES|Q)?\s*$/i

function parseFPPlayerField(raw) {
  const str = String(raw).trim()
  const m = str.match(FP_NAME_RE)
  if (m) {
    const positions = m[3].split(',')
      .map(p => p.trim().toUpperCase())
      .filter(p => ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'].includes(p))
    const statusRaw = (m[4] || '').toUpperCase()
    return {
      name: m[1].trim(),
      team: m[2].toUpperCase(),
      positions,
      injuryStatus: statusRaw === 'OUT' ? 'out' : statusRaw === 'DTD' ? 'day-to-day' : statusRaw === 'QUES' || statusRaw === 'Q' ? 'questionable' : 'healthy',
      injuryRisk: statusRaw === 'OUT' || statusRaw === 'DTD',
    }
  }
  // No embedded team/pos — strip any trailing parenthetical and return plain name
  return {
    name: str.replace(/\s*\([^)]+\)\s*$/, '').trim(),
    team: '',
    positions: [],
    injuryStatus: 'healthy',
    injuryRisk: false,
  }
}

console.log(`\nReading ADP data from: ${ADP_FILE}`)
const fpRows = parseCSV(ADP_FILE)

const fpPlayers = []
for (const row of fpRows) {
  const nameRaw = col(row, 'Player Name', 'PLAYER NAME', 'Player', 'Name', 'PLAYER')
  const adp     = col(row, 'ADP', 'Avg', 'AVG', 'Average', 'AVG.', 'PROJ. ADP')
  const rank    = col(row, 'RK', 'Rank', 'RANK', 'Overall', 'Overall Rank')

  if (!nameRaw || !adp) continue

  const adpNum = parseNum(adp, 1)
  if (adpNum === null) continue

  const { name, team, positions, injuryStatus, injuryRisk } = parseFPPlayerField(nameRaw)

  // Fall back to the standalone TEAM/POS columns if the name had no embedded info
  const teamFallback = col(row, 'Team', 'TEAM', 'Tm', 'Team Abbreviation')
  const posFallback  = col(row, 'POS', 'Pos', 'Position', 'POSITION', 'Eligible Positions')

  fpPlayers.push({
    fpName: name,
    team: team || String(teamFallback || '').toUpperCase().trim(),
    pos: positions.length ? positions.join(',') : String(posFallback || '').trim(),
    positions,
    adp: adpNum,
    rank: parseNum(rank, 0) ?? fpPlayers.length + 1,
    injuryStatus,
    injuryRisk,
  })
}

// Sort by ADP, take top N
fpPlayers.sort((a, b) => a.adp - b.adp)
const topPlayers = fpPlayers.slice(0, TOP_N)
console.log(`  Found ${fpPlayers.length} players in ADP file, using top ${topPlayers.length}`)

// ─── Parse Basketball Reference per-game CSV ─────────────────────────────────

console.log(`Reading stats data from: ${STATS_FILE}`)
const bbRows = parseCSV(STATS_FILE)

// Build a lookup map: normalizedName → stats row
// BBRef has duplicate rows for traded players (one per team + "2TM"/"3TM" total row).
// Keep only the TOT row for multi-team players.
const bbMap = new Map() // normalizedName → row

for (const row of bbRows) {
  const name = col(row, 'Player', 'PLAYER', 'Name')
  const team = col(row, 'Tm', 'Team', 'TM')
  if (!name || name.toLowerCase() === 'player') continue // skip header repeats

  const key = normalizeName(name)
  const existing = bbMap.get(key)

  if (!existing) {
    bbMap.set(key, { ...row, _bbrefName: String(name).trim() })
  } else {
    // If we see a TOT/2TM/3TM row, it's the aggregate — prefer it
    const teamStr = String(team || '').toUpperCase()
    if (['TOT', '2TM', '3TM', '4TM'].includes(teamStr)) {
      bbMap.set(key, { ...row, _bbrefName: String(name).trim() })
    }
  }
}

console.log(`  Found ${bbMap.size} players in stats file`)

// ─── Match FP players to BBRef stats ─────────────────────────────────────────

const matched = []
const reviewList = []

function findBBRef(fpName) {
  const normFp = normalizeName(fpName)

  // 1. Manual fix from review.json
  if (fixes[normFp]) {
    if (fixes[normFp].skip) return { skip: true }
    const fixKey = normalizeName(fixes[normFp].bbrefName)
    if (bbMap.has(fixKey)) return { row: bbMap.get(fixKey), confidence: 1, method: 'fix' }
  }

  // 2. Alias map
  if (normalizedAliases[normFp]) {
    const aliasKey = normalizeName(normalizedAliases[normFp])
    if (bbMap.has(aliasKey)) return { row: bbMap.get(aliasKey), confidence: 1, method: 'alias' }
  }

  // 3. Exact normalized match
  if (bbMap.has(normFp)) return { row: bbMap.get(normFp), confidence: 1, method: 'exact' }

  // 4. Fuzzy match — find best Dice score across all BBRef names
  let bestScore = 0
  let bestRow = null
  for (const [bbKey, bbRow] of bbMap) {
    const score = dice(normFp, bbKey)
    if (score > bestScore) {
      bestScore = score
      bestRow = bbRow
    }
  }

  if (bestScore >= FUZZY_THRESHOLD) {
    return { row: bestRow, confidence: bestScore, method: 'fuzzy' }
  }

  return { row: bestRow, confidence: bestScore, method: 'unmatched' }
}

for (const fp of topPlayers) {
  const result = findBBRef(fp.fpName)

  if (result.skip) {
    console.log(`  SKIP  ${fp.fpName}`)
    continue
  }

  const { row, confidence, method } = result
  // Use positions already parsed from the embedded FP name field; fall back to
  // the standalone pos column if the name had none.
  const positions = fp.positions.length ? fp.positions : parsePositions(fp.pos)

  const player = {
    id:            slugify(fp.fpName),
    name:          fp.fpName,
    team:          fp.team,
    positions,
    yahoo_positions: positions,
    adp:           fp.adp,
    adp_source:    ADP_SOURCE,
    auction_value: deriveAuctionValue(fp.adp),
    prior_season: row ? {
      pts:      parseNum(col(row, 'PTS', 'pts', 'PPG'), 1),
      reb:      parseNum(col(row, 'TRB', 'REB', 'reb', 'RPG'), 1),
      ast:      parseNum(col(row, 'AST', 'ast', 'APG'), 1),
      stl:      parseNum(col(row, 'STL', 'stl', 'SPG'), 1),
      blk:      parseNum(col(row, 'BLK', 'blk', 'BPG'), 1),
      to:       parseNum(col(row, 'TOV', 'TO', 'to', 'Turnovers'), 1),
      fg_pct:   parseNum(col(row, 'FG%', 'FG_PCT', 'fg%', 'FGP'), 3),
      ft_pct:   parseNum(col(row, 'FT%', 'FT_PCT', 'ft%', 'FTP'), 3),
      three_pm: parseNum(col(row, '3P', '3PM', '3p', 'three_pm', '3-PM'), 1),
      gp:       parseNum(col(row, 'G', 'GP', 'Games', 'games'), 0),
    } : null,
    age:           row ? parseNum(col(row, 'Age', 'AGE', 'age'), 0) : null,
    injury_risk:   fp.injuryRisk,
    injury_notes:  null,
    injury_status: fp.injuryStatus,
    contract_year: false,
    notes:         null,
  }

  if (!row || method === 'unmatched') {
    // No stats match — add to review, still include player in output with null stats
    reviewList.push({
      fpName:     fp.fpName,
      team:       fp.team,
      pos:        fp.pos,
      adp:        fp.adp,
      bbrefMatch: row ? row._bbrefName : null,
      confidence: parseFloat((confidence || 0).toFixed(3)),
      action:     'match',   // change to "skip" in review.json to exclude player
      bbrefName:  row ? row._bbrefName : '',
      note:       'Set action to "match" with the correct bbrefName, then re-run with --apply-fixes',
    })
    console.log(`  REVIEW  ${fp.fpName.padEnd(30)} (best: ${row ? row._bbrefName : 'no match'}, score: ${(confidence || 0).toFixed(2)})`)
  } else {
    if (method === 'fuzzy' && confidence < 0.9) {
      // Auto-matched but low confidence — flag in review for verification (don't block output)
      reviewList.push({
        fpName:     fp.fpName,
        team:       fp.team,
        pos:        fp.pos,
        adp:        fp.adp,
        bbrefMatch: row._bbrefName,
        confidence: parseFloat(confidence.toFixed(3)),
        action:     'confirm',
        note:       'Auto-matched (fuzzy) — verify this is correct',
      })
    }
    matched.push(player)
  }

  if (method === 'exact' || (method === 'fuzzy' && confidence >= 0.9) || method === 'alias' || method === 'fix') {
    if (!matched.includes(player)) matched.push(player)
  }
}

// Sort output by ADP
matched.sort((a, b) => a.adp - b.adp)

// ─── Write outputs ────────────────────────────────────────────────────────────

const outputDir = path.dirname(OUTPUT_FILE)
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(matched, null, 2))
fs.writeFileSync(REVIEW_FILE, JSON.stringify(reviewList, null, 2))

const reviewNeeded = reviewList.filter(r => r.action === 'match')
const needsConfirm = reviewList.filter(r => r.action === 'confirm')

console.log(`
─────────────────────────────────────────
  Done.

  ✓ Matched:         ${matched.length} / ${topPlayers.length} players
  ⚠ Review needed:   ${reviewNeeded.length} players (no stats found)
  ~ Verify:          ${needsConfirm.length} players (fuzzy match, confirm correct)

  Output:  ${OUTPUT_FILE}
  Review:  ${REVIEW_FILE}
─────────────────────────────────────────
${reviewNeeded.length > 0 ? `
Next steps:
  1. Open ${path.basename(REVIEW_FILE)}
  2. For each entry with action "match": set bbrefName to the correct BBRef player name
  3. To skip a player entirely: set action to "skip"
  4. Re-run with --apply-fixes flag
` : ''}`)
