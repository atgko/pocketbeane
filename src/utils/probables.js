'use strict'

/**
 * probables.js — Y-05c MLB Pitcher Probable-Start Tracking
 *
 * Pure query functions over src/data/mlb_probables.json (see
 * scripts/fetch_mlb_probables.py). No I/O — callers (pitching-starts.js)
 * read and parse the probables file themselves and pass the resulting
 * object in here. Written as CommonJS (matching src/utils/schedule.js) so
 * it's testable via plain `node`.
 */

// Mirrors src/utils/playerName.js's normalizeName rules (diacritic
// stripping, suffix removal, etc.) but duplicated as CommonJS rather than
// imported — playerName.js is an ESM module (fine inside Next.js's
// bundler, not requirable from the plain `node` test run this file needs
// to support). Keep the two in sync if either's rules change.
function normalizePitcherName(name) {
  return String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseUTCDate(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`)
}

// getPitcherStartsInRange(probablesData, {pitcherId, name}, startDate, endDate)
//   -> [{date, opponent, home}] sorted by date
//
//   Matches primarily on pitcher_id (players.json id — set by
//   fetch_mlb_probables.py's own scrape-time name match). Falls back to a
//   live name comparison only for rows the scraper itself couldn't match
//   (pitcher_id === null there), so a player added to the roster pool after
//   the last weekly scrape can still be found.
function getPitcherStartsInRange(probablesData, { pitcherId, name } = {}, startDate, endDate) {
  const starts = probablesData?.starts ?? []
  const start = parseUTCDate(startDate)
  const end = parseUTCDate(endDate)
  const normalizedName = name ? normalizePitcherName(name) : null

  return starts
    .filter((s) => {
      // A row the scraper already resolved to a player_id is only ever
      // matched by that exact id — never re-opened to a name comparison,
      // which could otherwise false-positive on two pitchers sharing a
      // normalized name. Only rows the scraper couldn't resolve
      // (pitcher_id === null) fall back to a live name comparison.
      const matches = s.pitcher_id != null
        ? s.pitcher_id === pitcherId
        : normalizedName != null && normalizePitcherName(s.pitcher_name) === normalizedName
      if (!matches) return false
      const gameDate = parseUTCDate(s.date)
      return gameDate >= start && gameDate <= end
    })
    .map((s) => ({ date: s.date, opponent: s.opponent, home: s.home }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

// hasFullCoverage(probablesData, startDate, endDate) -> boolean
//   True only if the scraped window's date_range fully contains
//   [startDate, endDate]. Distinguishes "this pitcher genuinely has zero
//   starts this week" (safe to call a hold) from "this week extends past
//   what FanGraphs has posted yet" (probable starts aren't announced until
//   ~5 days out — an empty result there means "not yet known", not "no
//   start").
function hasFullCoverage(probablesData, startDate, endDate) {
  const range = probablesData?.date_range
  if (!range?.start || !range?.end) return false
  return parseUTCDate(range.start) <= parseUTCDate(startDate) && parseUTCDate(range.end) >= parseUTCDate(endDate)
}

// isProbablesDataUsable(probablesData) -> boolean
//   Gate on the scraper's own freshness flag — a stale pull (rotations
//   shuffle, rainouts happen) shouldn't silently drive a start/hold call.
function isProbablesDataUsable(probablesData) {
  return Boolean(probablesData) && probablesData.stale !== true
}

module.exports = {
  getPitcherStartsInRange,
  hasFullCoverage,
  isProbablesDataUsable,
  normalizePitcherName,
}
