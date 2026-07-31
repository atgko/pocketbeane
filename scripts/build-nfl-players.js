#!/usr/bin/env node
'use strict'

/**
 * build-nfl-players.js
 *
 * Merges a FantasyPros ADP CSV and three Pro-Football-Reference 2025 season
 * CSVs (passing, rushing, receiving) into nfl_players.json for PocketBeane.
 *
 * fantasy_ppg is computed from the league's actual half-PPR scoring weights
 * (0.04/pass-yd, 4/pass-TD, -1/INT, 0.1/rush-yd, 6/rush-TD, 0.5/rec,
 * 0.1/rec-yd, 6/rec-TD) applied to season totals, divided by games played.
 * Fumbles-lost, return TDs, and 2-point conversions are NOT included — PFR's
 * standard tables expose total fumbles (not fumbles *lost*) and don't isolate
 * return TDs per player, so this is a deliberate approximation, same spirit
 * as ADP itself being an approximation.
 *
 * K/DEF have no stat source here (not in these PFR tables) — they're kept in
 * the output with prior_season: null; ranking falls back to ADP only, same
 * pattern build-players.js already uses for any unmatched player.
 *
 * Usage:
 *   node scripts/build-nfl-players.js --adp <file> --passing <file> --rushing <file> --receiving <file>
 *   node scripts/build-nfl-players.js --adp <file> --passing <file> --rushing <file> --receiving <file> --apply-fixes
 *
 * Flags:
 *   --adp        Path to FantasyPros NFL consensus ADP CSV (required)
 *   --passing    Path to Pro-Football-Reference 2025 passing CSV (required)
 *   --rushing    Path to Pro-Football-Reference 2025 rushing CSV (required)
 *   --receiving  Path to Pro-Football-Reference 2025 receiving CSV (required)
 *   --apply-fixes  Apply manual fixes from scripts/nfl-review.json before matching
 *   --output     Output path (default: ./src/data/nfl_players.json)
 *   --review     Review output path (default: ./scripts/nfl-review.json)
 *   --source     ADP source label (default: "FantasyPros Consensus 2026 NFL")
 *   --top        How many players to include (default: 250)
 *
 * PFR source pages (use "Share & Export → Get table as CSV" on each):
 *   Passing:   https://www.pro-football-reference.com/years/2025/passing.htm
 *   Rushing:   https://www.pro-football-reference.com/years/2025/rushing.htm
 *   Receiving: https://www.pro-football-reference.com/years/2025/receiving.htm
 *
 * FantasyPros source:
 *   https://www.fantasypros.com/nfl/adp/overall.php
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

const ADP_FILE       = flags.adp
const PASSING_FILE   = flags.passing
const RUSHING_FILE   = flags.rushing
const RECEIVING_FILE = flags.receiving
const APPLY_FIXES    = flags['apply-fixes'] === true
const OUTPUT_FILE    = flags.output  || path.resolve(__dirname, '..', 'src', 'data', 'nfl_players.json')
const REVIEW_FILE    = flags.review  || path.resolve(__dirname, 'nfl-review.json')
const ADP_SOURCE     = flags.source  || 'FantasyPros Consensus 2026 NFL'
const TOP_N          = parseInt(flags.top || '250', 10)
const FUZZY_THRESHOLD = 0.70

if (!ADP_FILE || !PASSING_FILE || !RUSHING_FILE || !RECEIVING_FILE) {
  console.error([
    '',
    '  Usage: node scripts/build-nfl-players.js --adp <file> --passing <file> --rushing <file> --receiving <file>',
    '',
    '  --adp        FantasyPros NFL consensus ADP CSV (required)',
    '  --passing    Pro-Football-Reference 2025 passing CSV (required)',
    '  --rushing    Pro-Football-Reference 2025 rushing CSV (required)',
    '  --receiving  Pro-Football-Reference 2025 receiving CSV (required)',
    '',
  ].join('\n'))
  process.exit(1)
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function normalizeName(raw) {
  return String(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\?/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(name) {
  return normalizeName(name)
    .replace(/['\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

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

function col(row, ...candidates) {
  const keys = Object.keys(row)
  for (const c of candidates) {
    const cNorm = c.toLowerCase().replace(/[^a-z0-9%]/g, '')
    const key = keys.find(k => k.toLowerCase().replace(/[^a-z0-9%]/g, '') === cNorm)
    if (key !== undefined && row[key] !== '' && row[key] !== undefined) return row[key]
  }
  return null
}

// Parse CSV — handles quoted fields, Windows/Unix line endings, BBRef/PFR's
// "Share & Export" quote-wrapped rows, and strips the trailing "League
// Average" summary row + HTML citation footer that PFR exports include
// (these can appear mid-file too, e.g. when a browser export accidentally
// concatenates two tables — filtering line-by-line handles that safely).
function parseCSV(filePath) {
  let raw = fs.readFileSync(filePath, 'utf-8')
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

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
          return (trimmed.startsWith('"') && trimmed.endsWith('"')) ? trimmed.slice(1, -1) : l
        })
        .join('\n')
    }
  }

  const lines = raw.split('\n')
    .filter(l => l.trim())
    .filter(l => !/,League Average,/.test(l))
    .filter(l => !/^"?Provided by/.test(l.trim()))

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
    // First occurrence wins when a header name repeats (PFR's passing table
    // has TWO columns literally named "Yds" — passing yards at index 11 and
    // sack-yards-lost at index 26 — naive last-wins assignment would silently
    // overwrite real passing yards with sack yardage for every QB).
    headers.forEach((h, idx) => {
      if (row[h] === undefined) row[h] = vals[idx] ?? ''
    })
    rows.push(row)
  }
  return rows
}

// NFL auction value: log-linear model for a 16-slot roster, $200 budget.
// adp=1   → $65
// adp=190 → $1  (approx. last rostered player in a 10-team, 16-round league)
const NFL_AUCTION_A = 65
const NFL_AUCTION_B = 64 / Math.log(190)

function deriveAuctionValue(adp) {
  const raw = NFL_AUCTION_A - NFL_AUCTION_B * Math.log(Math.max(1, adp))
  return Math.max(1, Math.round(raw))
}

function parseNum(val, decimals = 1) {
  if (val === null || val === undefined || val === '' || val === 'N/A' || val === '--') return null
  const n = parseFloat(String(val).replace(/,/g, ''))
  if (isNaN(n)) return null
  return parseFloat(n.toFixed(decimals))
}

// Yahoo's NFL slot type is 'DEF', not FantasyPros' 'DST' — normalize here so
// positions/yahoo_positions line up with SPORT_CONFIGS.nfl.filterPositions.
const NFL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF'])

function parseNFLPosition(raw) {
  if (!raw) return null
  // Strip positional rank suffix ("RB1" -> "RB", "DST24" -> "DST")
  let pos = String(raw).trim().toUpperCase().replace(/\d+$/, '')
  if (pos === 'DST' || pos === 'DEF') pos = 'DEF'
  return NFL_POSITIONS.has(pos) ? pos : null
}

// FantasyPros NFL ADP name field: "Bijan Robinson   ATL (11)" (player) or
// "Las Vegas Raiders DST   (13)" (defense — team's full name plus a "DST"
// token where a real team code would sit for skill players). Group 2 is
// required to be an ALL-CAPS token so mixed-case name words never match it.
const FP_NAME_RE = /^(.+?)\s+([A-Z]{2,5})\s*\(([^)]+)\)\s*$/

function parseFPPlayerField(raw) {
  const str = String(raw).trim()
  const m = str.match(FP_NAME_RE)
  if (m) {
    return { name: m[1].trim(), team: m[2].toUpperCase(), bye: m[3].trim() }
  }
  return { name: str, team: '', bye: null }
}

// ─── Load fixes ───────────────────────────────────────────────────────────────

const fixes = {}
if (APPLY_FIXES) {
  if (!fs.existsSync(REVIEW_FILE)) {
    console.error(`--apply-fixes: ${REVIEW_FILE} not found`)
    process.exit(1)
  }
  const reviewData = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf-8'))
  for (const entry of reviewData) {
    if (!entry.fpName) continue
    const key = normalizeName(entry.fpName)
    if (entry.action === 'skip') {
      fixes[key] = { skip: true }
    } else if (entry.action === 'match' && entry.pfrName) {
      fixes[key] = { pfrName: entry.pfrName }
    }
  }
  console.log(`Loaded ${Object.keys(fixes).length} manual fixes from ${REVIEW_FILE}`)
}

// ─── Parse FantasyPros ADP CSV ────────────────────────────────────────────────

console.log(`\nReading NFL ADP data from: ${ADP_FILE}`)
const fpRows = parseCSV(ADP_FILE)

const fpPlayers = []
for (const row of fpRows) {
  const nameRaw = col(row, 'Player (Bye)', 'Player Name', 'PLAYER NAME', 'Player', 'Name', 'PLAYER')
  const adp     = col(row, 'ADP', 'Avg', 'AVG', 'Average', 'AVG.', 'PROJ. ADP')
  const rank    = col(row, 'RK', 'Rank', 'RANK', 'Overall', 'Overall Rank')
  const posRaw  = col(row, 'POS', 'Pos', 'Position')

  if (!nameRaw || !adp) continue
  const adpNum = parseNum(adp, 1)
  if (adpNum === null) continue

  const { name, team, bye } = parseFPPlayerField(nameRaw)
  const position = parseNFLPosition(posRaw)

  fpPlayers.push({
    fpName: name,
    team,
    bye,
    pos: position ?? '',
    positions: position ? [position] : [],
    adp: adpNum,
    rank: parseNum(rank, 0) ?? fpPlayers.length + 1,
  })
}

fpPlayers.sort((a, b) => a.adp - b.adp)
const topPlayers = fpPlayers.slice(0, TOP_N)
console.log(`  Found ${fpPlayers.length} players in ADP file, using top ${topPlayers.length}`)

// ─── Parse Pro-Football-Reference CSVs ───────────────────────────────────────

function buildPFRMap(rows) {
  const map = new Map()
  for (const row of rows) {
    const name = col(row, 'Player', 'Name')
    const team = col(row, 'Tm', 'Team', 'TM')
    if (!name || name.toLowerCase() === 'player') continue
    const key = normalizeName(name)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...row, _pfrName: String(name).trim() })
    } else {
      const teamStr = String(team || '').toUpperCase()
      if (['TOT', '2TM', '3TM', '4TM'].includes(teamStr)) {
        map.set(key, { ...row, _pfrName: String(name).trim() })
      }
    }
  }
  return map
}

console.log(`Reading passing stats from: ${PASSING_FILE}`)
const passingMap = buildPFRMap(parseCSV(PASSING_FILE))
console.log(`  Found ${passingMap.size} passers`)

console.log(`Reading rushing stats from: ${RUSHING_FILE}`)
const rushingMap = buildPFRMap(parseCSV(RUSHING_FILE))
console.log(`  Found ${rushingMap.size} rushers`)

console.log(`Reading receiving stats from: ${RECEIVING_FILE}`)
const receivingMap = buildPFRMap(parseCSV(RECEIVING_FILE))
console.log(`  Found ${receivingMap.size} receivers`)

// ─── Match FP players to PFR stats ───────────────────────────────────────────

function findPFR(fpName, statsMap) {
  const normFp = normalizeName(fpName)

  if (fixes[normFp]) {
    if (fixes[normFp].skip) return { skip: true }
    const fixKey = normalizeName(fixes[normFp].pfrName)
    if (statsMap.has(fixKey)) return { row: statsMap.get(fixKey), confidence: 1, method: 'fix' }
  }

  if (statsMap.has(normFp)) return { row: statsMap.get(normFp), confidence: 1, method: 'exact' }

  let bestScore = 0
  let bestRow = null
  for (const [key, r] of statsMap) {
    const score = dice(normFp, key)
    if (score > bestScore) { bestScore = score; bestRow = r }
  }

  if (bestScore >= FUZZY_THRESHOLD) return { row: bestRow, confidence: bestScore, method: 'fuzzy' }
  return { row: bestRow, confidence: bestScore, method: 'unmatched' }
}

// League's actual half-PPR scoring weights (from the user's Yahoo settings).
// Fumbles-lost, return TDs, and 2-pt conversions are omitted — see file header.
const SCORING = {
  pass_yd: 0.04, pass_td: 4, int: -1,
  rush_yd: 0.1,  rush_td: 6,
  rec: 0.5, rec_yd: 0.1, rec_td: 6,
}

function computeFantasyPpg(stats, gp) {
  if (!gp || gp <= 0) return null
  const total =
    (stats.pass_yd ?? 0) * SCORING.pass_yd +
    (stats.pass_td ?? 0) * SCORING.pass_td +
    (stats.int ?? 0) * SCORING.int +
    (stats.rush_yd ?? 0) * SCORING.rush_yd +
    (stats.rush_td ?? 0) * SCORING.rush_td +
    (stats.rec ?? 0) * SCORING.rec +
    (stats.rec_yd ?? 0) * SCORING.rec_yd +
    (stats.rec_td ?? 0) * SCORING.rec_td
  return parseFloat((total / gp).toFixed(2))
}

const matched = []
const reviewList = []

for (const fp of topPlayers) {
  const position = fp.positions[0] ?? null

  // K/DEF aren't in these PFR tables at all — no stats to match against.
  if (position === 'K' || position === 'DEF' || !position) {
    matched.push({
      id: slugify(fp.fpName),
      name: fp.fpName,
      team: fp.team,
      positions: fp.positions,
      yahoo_positions: fp.positions,
      adp: fp.adp,
      adp_source: ADP_SOURCE,
      auction_value: deriveAuctionValue(fp.adp),
      prior_season: null,
      age: null,
      injury_risk: false,
      injury_notes: null,
      injury_status: 'healthy',
      contract_year: false,
      notes: null,
    })
    continue
  }

  // QBs primarily need passing stats (some also rush); RB/WR/TE need
  // rushing+receiving. Try the position-primary map first for match
  // reporting, but pull from all three maps by name for the actual merge —
  // a RB or mobile QB can appear in more than one table.
  const primaryMap = position === 'QB' ? passingMap : position === 'RB' ? rushingMap : receivingMap
  const result = findPFR(fp.fpName, primaryMap)

  if (result.skip) {
    console.log(`  SKIP  ${fp.fpName}`)
    continue
  }

  const passingRow   = passingMap.get(normalizeName(fp.fpName)) ?? (result.method !== 'unmatched' && primaryMap === passingMap ? result.row : null)
  const rushingRow   = rushingMap.get(normalizeName(fp.fpName)) ?? (result.method !== 'unmatched' && primaryMap === rushingMap ? result.row : null)
  const receivingRow = receivingMap.get(normalizeName(fp.fpName)) ?? (result.method !== 'unmatched' && primaryMap === receivingMap ? result.row : null)

  const anyRow = passingRow || rushingRow || receivingRow

  let prior_season = null
  if (anyRow) {
    const gp = parseNum(col(passingRow ?? rushingRow ?? receivingRow, 'G', 'GP', 'Games'), 0)
    const stats = {
      pass_yd: passingRow ? parseNum(col(passingRow, 'Yds'), 0) : null,
      pass_td: passingRow ? parseNum(col(passingRow, 'TD'), 0) : null,
      int:     passingRow ? parseNum(col(passingRow, 'Int'), 0) : null,
      rush_yd: rushingRow ? parseNum(col(rushingRow, 'Yds'), 0) : null,
      rush_td: rushingRow ? parseNum(col(rushingRow, 'TD'), 0) : null,
      rec:     receivingRow ? parseNum(col(receivingRow, 'Rec'), 0) : null,
      rec_yd:  receivingRow ? parseNum(col(receivingRow, 'Yds'), 0) : null,
      rec_td:  receivingRow ? parseNum(col(receivingRow, 'TD'), 0) : null,
      gp,
    }
    prior_season = { ...stats, fantasy_ppg: computeFantasyPpg(stats, gp) }
  }

  const player = {
    id: slugify(fp.fpName),
    name: fp.fpName,
    team: fp.team,
    positions: fp.positions,
    yahoo_positions: fp.positions,
    adp: fp.adp,
    adp_source: ADP_SOURCE,
    auction_value: deriveAuctionValue(fp.adp),
    prior_season,
    age: anyRow ? parseNum(col(anyRow, 'Age', 'AGE', 'age'), 0) : null,
    injury_risk: false,
    injury_notes: null,
    injury_status: 'healthy',
    contract_year: false,
    notes: null,
  }

  if (!anyRow || result.method === 'unmatched') {
    reviewList.push({
      fpName: fp.fpName,
      team: fp.team,
      pos: fp.pos,
      adp: fp.adp,
      pfrMatch: result.row ? result.row._pfrName : null,
      confidence: parseFloat((result.confidence || 0).toFixed(3)),
      action: 'match',
      pfrName: result.row ? result.row._pfrName : '',
      note: 'Set action to "match" with the correct pfrName, then re-run with --apply-fixes',
    })
    console.log(`  REVIEW  ${fp.fpName.padEnd(30)} [${position}] (best: ${result.row ? result.row._pfrName : 'no match'}, score: ${(result.confidence || 0).toFixed(2)})`)
    matched.push(player)
  } else {
    if (result.method === 'fuzzy' && result.confidence < 0.9) {
      reviewList.push({
        fpName: fp.fpName,
        team: fp.team,
        pos: fp.pos,
        adp: fp.adp,
        pfrMatch: result.row._pfrName,
        confidence: parseFloat(result.confidence.toFixed(3)),
        action: 'confirm',
        note: 'Auto-matched (fuzzy) — verify this is correct',
      })
    }
    matched.push(player)
  }
}

matched.sort((a, b) => a.adp - b.adp)

// ─── Write outputs ────────────────────────────────────────────────────────────

const outputDir = path.dirname(OUTPUT_FILE)
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(matched, null, 2))
fs.writeFileSync(REVIEW_FILE, JSON.stringify(reviewList, null, 2))

const reviewNeeded = reviewList.filter(r => r.action === 'match')
const needsConfirm = reviewList.filter(r => r.action === 'confirm')
const withStats = matched.filter(p => p.prior_season != null).length

console.log(`
─────────────────────────────────────────
  Done.

  ✓ Matched:         ${matched.length} / ${topPlayers.length} players
    With stats:      ${withStats}
    K/DEF (no stats): ${matched.length - withStats}
  ⚠ Review needed:   ${reviewNeeded.length} players (no stats found)
  ~ Verify:          ${needsConfirm.length} players (fuzzy match, confirm correct)

  Output:  ${OUTPUT_FILE}
  Review:  ${REVIEW_FILE}
─────────────────────────────────────────
${reviewNeeded.length > 0 ? `
Next steps:
  1. Open ${path.basename(REVIEW_FILE)}
  2. For each entry with action "match": set pfrName to the correct player name
  3. To skip entirely: set action to "skip"
  4. Re-run with --apply-fixes
` : ''}`)
