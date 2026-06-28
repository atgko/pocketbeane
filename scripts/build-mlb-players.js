#!/usr/bin/env node
'use strict'

/**
 * build-mlb-players.js
 *
 * Merges a FantasyPros ADP CSV and Baseball Reference batting + pitching CSVs
 * into mlb_players.json for PocketBeane.
 *
 * Stats are stored as season totals (counting) or rates (avg, era, whip) — NOT per-game.
 * This matches the MLB benchmarks in sports.js which are calibrated to season totals.
 *
 * Usage:
 *   node scripts/build-mlb-players.js --adp <file> --batting <file> --pitching <file>
 *   node scripts/build-mlb-players.js --adp <file> --batting <file> --pitching <file> --apply-fixes
 *
 * Flags:
 *   --adp        Path to FantasyPros MLB ADP CSV (required)
 *   --batting    Path to Baseball Reference standard batting CSV (required)
 *   --pitching   Path to Baseball Reference standard pitching CSV (required)
 *   --apply-fixes  Apply manual fixes from scripts/mlb-review.json before matching
 *   --output     Output path (default: ./src/data/mlb_players.json)
 *   --review     Review output path (default: ./scripts/mlb-review.json)
 *   --source     ADP source label (default: "FantasyPros Yahoo 10-team 2026 MLB")
 *   --top        How many players to include (default: 300)
 *
 * BBRef source pages:
 *   Batting:  https://www.baseball-reference.com/leagues/majors/2025-standard-batting.shtml
 *   Pitching: https://www.baseball-reference.com/leagues/majors/2025-standard-pitching.shtml
 *   (Use "Share & Export → Get table as CSV" on each page)
 *
 * FantasyPros source:
 *   https://www.fantasypros.com/mlb/rankings/consensus-cheatsheets.php
 *   (Export the overall consensus rankings as CSV)
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

const ADP_FILE      = flags.adp
const BATTING_FILE  = flags.batting
const PITCHING_FILE = flags.pitching
const APPLY_FIXES   = flags['apply-fixes'] === true
const OUTPUT_FILE   = flags.output  || path.resolve(__dirname, '..', 'src', 'data', 'mlb_players.json')
const REVIEW_FILE   = flags.review  || path.resolve(__dirname, 'mlb-review.json')
const ADP_SOURCE    = flags.source  || 'FantasyPros Yahoo 10-team 2026 MLB'
const TOP_N         = parseInt(flags.top || '300', 10)
const FUZZY_THRESHOLD = 0.70

if (!ADP_FILE || !BATTING_FILE || !PITCHING_FILE) {
  console.error([
    '',
    '  Usage: node scripts/build-mlb-players.js --adp <file> --batting <file> --pitching <file>',
    '',
    '  --adp      FantasyPros MLB overall ADP CSV (required)',
    '  --batting  Baseball Reference standard batting CSV (required)',
    '  --pitching Baseball Reference standard pitching CSV (required)',
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

// MLB auction value: log-linear model for 23-man roster, $260 budget (Yahoo default for MLB)
// adp=1   → $65 (top overall pick — elite OF/1B)
// adp=20  → $35
// adp=100 → $10
// adp=230 → $1  (last rostered player in 10×23 league)
const MLB_AUCTION_A = 65
const MLB_AUCTION_B = 64 / Math.log(230)

function deriveAuctionValue(adp) {
  const raw = MLB_AUCTION_A - MLB_AUCTION_B * Math.log(Math.max(1, adp))
  return Math.max(1, Math.round(raw))
}

function parseNum(val, decimals = 1) {
  if (val === null || val === undefined || val === '' || val === 'N/A' || val === '--') return null
  const n = parseFloat(String(val).replace(/,/g, ''))
  if (isNaN(n)) return null
  return parseFloat(n.toFixed(decimals))
}

// Valid MLB positions from FantasyPros: C, 1B, 2B, 3B, SS, OF, LF, CF, RF, DH, SP, RP, P, UTIL
const MLB_POSITIONS = new Set(['C', '1B', '2B', '3B', 'SS', 'OF', 'LF', 'CF', 'RF', 'DH', 'SP', 'RP', 'P', 'UTIL'])
const PITCHER_POSITIONS = new Set(['SP', 'RP', 'P'])

function parseMLBPositions(raw) {
  if (!raw) return []
  return String(raw)
    .split(/[,/|]/)
    .map(p => p.trim().toUpperCase())
    .filter(p => MLB_POSITIONS.has(p))
    .map(p => {
      // Normalize outfield variants to OF (Yahoo uses generic OF slot)
      if (['LF', 'CF', 'RF'].includes(p)) return 'OF'
      return p
    })
    .filter((p, i, arr) => arr.indexOf(p) === i) // deduplicate
}

function isPitcher(positions) {
  return positions.some(p => PITCHER_POSITIONS.has(p))
}

// FantasyPros MLB name field format: "Aaron Judge (NYY - OF)" or "Shohei Ohtani (LAD - SP,DH)"
const FP_NAME_RE = /^(.*?)\s*\(([A-Z]{2,3})\s*-\s*([^)]+)\)\s*(DTD|OUT|QUES|Q)?\s*$/i

function parseFPPlayerField(raw) {
  const str = String(raw).trim()
  const m = str.match(FP_NAME_RE)
  if (m) {
    const positions = parseMLBPositions(m[3])
    const statusRaw = (m[4] || '').toUpperCase()
    return {
      name: m[1].trim(),
      team: m[2].toUpperCase(),
      positions,
      injuryStatus: statusRaw === 'OUT' ? 'out' : statusRaw === 'DTD' ? 'day-to-day' : statusRaw === 'QUES' || statusRaw === 'Q' ? 'questionable' : 'healthy',
      injuryRisk: statusRaw === 'OUT' || statusRaw === 'DTD',
    }
  }
  return {
    name: str.replace(/\s*\([^)]+\)\s*$/, '').trim(),
    team: '',
    positions: [],
    injuryStatus: 'healthy',
    injuryRisk: false,
  }
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
    } else if (entry.action === 'match' && entry.bbrefName) {
      fixes[key] = { bbrefName: entry.bbrefName }
    }
  }
  console.log(`Loaded ${Object.keys(fixes).length} manual fixes from ${REVIEW_FILE}`)
}

// ─── Parse FantasyPros ADP CSV ────────────────────────────────────────────────

console.log(`\nReading MLB ADP data from: ${ADP_FILE}`)
const fpRows = parseCSV(ADP_FILE)

const fpPlayers = []
for (const row of fpRows) {
  const nameRaw = col(row, 'Player Name', 'PLAYER NAME', 'Player', 'Name', 'PLAYER')
  const adp     = col(row, 'ADP', 'Avg', 'AVG', 'Average', 'AVG.', 'PROJ. ADP')
  const rank    = col(row, 'RK', 'Rank', 'RANK', 'Overall', 'Overall Rank')

  if (!nameRaw || !adp) continue
  // Skip split two-way player entries (e.g. "Shohei Ohtani (Batter)") — use the combined entry
  if (/\(Batter\)|\(Pitcher\)/i.test(String(nameRaw))) continue
  const adpNum = parseNum(adp, 1)
  if (adpNum === null) continue

  const { name, team, positions, injuryStatus, injuryRisk } = parseFPPlayerField(nameRaw)
  const teamFallback = col(row, 'Team', 'TEAM', 'Tm')
  const posFallback  = col(row, 'POS', 'Pos', 'Position', 'Positions', 'Eligible Positions')

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

fpPlayers.sort((a, b) => a.adp - b.adp)
const topPlayers = fpPlayers.slice(0, TOP_N)
console.log(`  Found ${fpPlayers.length} players in ADP file, using top ${topPlayers.length}`)

// ─── Parse Baseball Reference CSVs ───────────────────────────────────────────

function buildBBRefMap(rows) {
  const map = new Map()
  for (const row of rows) {
    const name = col(row, 'Player', 'Name')
    const team = col(row, 'Tm', 'Team', 'TM')
    if (!name || name.toLowerCase() === 'player') continue
    const key = normalizeName(name)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...row, _bbrefName: String(name).trim() })
    } else {
      const teamStr = String(team || '').toUpperCase()
      if (['TOT', '2TM', '3TM', '4TM'].includes(teamStr)) {
        map.set(key, { ...row, _bbrefName: String(name).trim() })
      }
    }
  }
  return map
}

console.log(`Reading batting stats from: ${BATTING_FILE}`)
const battingMap = buildBBRefMap(parseCSV(BATTING_FILE))
console.log(`  Found ${battingMap.size} batters`)

console.log(`Reading pitching stats from: ${PITCHING_FILE}`)
const pitchingMap = buildBBRefMap(parseCSV(PITCHING_FILE))
console.log(`  Found ${pitchingMap.size} pitchers`)

// ─── Match and build player records ──────────────────────────────────────────

function findBBRef(fpName, statsMap) {
  const normFp = normalizeName(fpName)

  if (fixes[normFp]) {
    if (fixes[normFp].skip) return { skip: true }
    const fixKey = normalizeName(fixes[normFp].bbrefName)
    if (statsMap.has(fixKey)) return { row: statsMap.get(fixKey), confidence: 1, method: 'fix' }
  }

  if (statsMap.has(normFp)) return { row: statsMap.get(normFp), confidence: 1, method: 'exact' }

  let bestScore = 0
  let bestRow = null
  for (const [bbKey, bbRow] of statsMap) {
    const score = dice(normFp, bbKey)
    if (score > bestScore) { bestScore = score; bestRow = bbRow }
  }

  if (bestScore >= FUZZY_THRESHOLD) return { row: bestRow, confidence: bestScore, method: 'fuzzy' }
  return { row: bestRow, confidence: bestScore, method: 'unmatched' }
}

const matched = []
const reviewList = []

for (const fp of topPlayers) {
  const positions = fp.positions.length ? fp.positions : parseMLBPositions(fp.pos)
  const pitcher = isPitcher(positions)
  const statsMap = pitcher ? pitchingMap : battingMap

  const result = findBBRef(fp.fpName, statsMap)
  if (result.skip) {
    console.log(`  SKIP  ${fp.fpName}`)
    continue
  }

  const { row, confidence, method } = result

  // Build prior_season — hitting or pitching stats depending on player type
  let prior_season = null
  if (row) {
    if (pitcher) {
      prior_season = {
        w:    parseNum(col(row, 'W', 'Wins'), 0),
        sv:   parseNum(col(row, 'SV', 'Saves', 'SVS'), 0),
        k:    parseNum(col(row, 'SO', 'K', 'Ks', 'Strikeouts'), 0),
        era:  parseNum(col(row, 'ERA'), 2),
        whip: parseNum(col(row, 'WHIP'), 3),
        gp:   parseNum(col(row, 'G', 'GP', 'Games'), 0),
        gs:   parseNum(col(row, 'GS', 'Games Started'), 0),
      }
    } else {
      prior_season = {
        r:    parseNum(col(row, 'R', 'Runs', 'R/G'), 0),
        hr:   parseNum(col(row, 'HR', 'Home Runs', 'HRs'), 0),
        rbi:  parseNum(col(row, 'RBI', 'RBIs'), 0),
        sb:   parseNum(col(row, 'SB', 'Stolen Bases'), 0),
        avg:  parseNum(col(row, 'BA', 'AVG', 'Avg', 'Batting Average'), 3),
        gp:   parseNum(col(row, 'G', 'GP', 'Games'), 0),
      }
    }
  }

  const player = {
    id:            slugify(fp.fpName),
    name:          fp.fpName,
    team:          fp.team,
    positions,
    yahoo_positions: positions,
    player_type:   pitcher ? 'pitcher' : 'hitter',
    adp:           fp.adp,
    adp_source:    ADP_SOURCE,
    auction_value: deriveAuctionValue(fp.adp),
    prior_season,
    age:           row ? parseNum(col(row, 'Age', 'AGE', 'age'), 0) : null,
    injury_risk:   fp.injuryRisk,
    injury_notes:  null,
    injury_status: fp.injuryStatus,
    contract_year: false,
    notes:         null,
  }

  if (!row || method === 'unmatched') {
    reviewList.push({
      fpName:     fp.fpName,
      team:       fp.team,
      pos:        fp.pos,
      playerType: pitcher ? 'pitcher' : 'hitter',
      adp:        fp.adp,
      bbrefMatch: row ? row._bbrefName : null,
      confidence: parseFloat((confidence || 0).toFixed(3)),
      action:     'match',
      bbrefName:  row ? row._bbrefName : '',
      note:       'Set action to "match" with the correct bbrefName, then re-run with --apply-fixes',
    })
    console.log(`  REVIEW  ${fp.fpName.padEnd(30)} [${pitcher ? 'P' : 'H'}] (best: ${row ? row._bbrefName : 'no match'}, score: ${(confidence || 0).toFixed(2)})`)
    // Still include in output with null stats — rookies/injured still need to appear on the board
    matched.push(player)
  } else {
    if (method === 'fuzzy' && confidence < 0.9) {
      reviewList.push({
        fpName:     fp.fpName,
        team:       fp.team,
        pos:        fp.pos,
        playerType: pitcher ? 'pitcher' : 'hitter',
        adp:        fp.adp,
        bbrefMatch: row._bbrefName,
        confidence: parseFloat(confidence.toFixed(3)),
        action:     'confirm',
        note:       'Auto-matched (fuzzy) — verify this is correct',
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
const hitters = matched.filter(p => p.player_type === 'hitter').length
const pitchers = matched.filter(p => p.player_type === 'pitcher').length

console.log(`
─────────────────────────────────────────
  Done.

  ✓ Matched:         ${matched.length} / ${topPlayers.length} players
    Hitters:         ${hitters}
    Pitchers:        ${pitchers}
  ⚠ Review needed:   ${reviewNeeded.length} players (no stats found)
  ~ Verify:          ${needsConfirm.length} players (fuzzy match, confirm correct)

  Output:  ${OUTPUT_FILE}
  Review:  ${REVIEW_FILE}
─────────────────────────────────────────
${reviewNeeded.length > 0 ? `
Next steps:
  1. Open ${path.basename(REVIEW_FILE)}
  2. For each entry with action "match": set bbrefName to the correct player name
  3. To skip entirely: set action to "skip"
  4. Re-run with --apply-fixes
` : ''}`)
