// Raw Sleeper API HTTP client. No auth (Sleeper's API is fully public), but
// Sleeper's own docs warn to "stay under 1000 calls/minute per IP or risk
// an IP block" — checkRateLimit() below is a same-process guard against
// that, not a distributed one (each serverless instance tracks its own
// window). It exists to catch runaway loops (e.g. an accidental per-request
// /players/nfl fetch — see playerMap.js for why that specific endpoint has
// its own daily cache on top of this) before they become Sleeper's problem,
// not to precisely enforce the limit across every instance PocketBeane
// might be running.

const BASE = 'https://api.sleeper.app/v1'
const RATE_LIMIT_PER_MINUTE = 1000
const WINDOW_MS = 60_000

let windowStart = Date.now()
let callsInWindow = 0

function checkRateLimit() {
  const now = Date.now()
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now
    callsInWindow = 0
  }
  callsInWindow++
  if (callsInWindow > RATE_LIMIT_PER_MINUTE) {
    throw new Error(`Sleeper client rate-limit guard tripped: more than ${RATE_LIMIT_PER_MINUTE} calls in the last minute — refusing further requests to avoid an IP block`)
  }
}

async function sleeperFetch(path) {
  checkRateLimit()
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    if (res.status === 404) return null
    const text = await res.text()
    throw new Error(`Sleeper API ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── Identity ───────────────────────────────────────────────────────────────
export const getUser = (usernameOrId) => sleeperFetch(`/user/${usernameOrId}`)

// ─── Leagues (NFL only — see memory project_sleeper_integration_scope) ──────
export const getUserLeagues = (userId, sport, season) => sleeperFetch(`/user/${userId}/leagues/${sport}/${season}`)
export const getLeague = (leagueId) => sleeperFetch(`/league/${leagueId}`)
export const getLeagueRosters = (leagueId) => sleeperFetch(`/league/${leagueId}/rosters`)
export const getLeagueUsers = (leagueId) => sleeperFetch(`/league/${leagueId}/users`)
export const getLeagueMatchups = (leagueId, week) => sleeperFetch(`/league/${leagueId}/matchups/${week}`)
export const getLeagueTransactions = (leagueId, week) => sleeperFetch(`/league/${leagueId}/transactions/${week}`)
export const getLeagueDrafts = (leagueId) => sleeperFetch(`/league/${leagueId}/drafts`)

// ─── Drafts ─────────────────────────────────────────────────────────────────
export const getUserDrafts = (userId, sport, season) => sleeperFetch(`/user/${userId}/drafts/${sport}/${season}`)
export const getDraft = (draftId) => sleeperFetch(`/draft/${draftId}`)
export const getDraftPicks = (draftId) => sleeperFetch(`/draft/${draftId}/picks`)

// ─── State ──────────────────────────────────────────────────────────────────
export const getState = (sport) => sleeperFetch(`/state/${sport}`)

// ─── Players — playerMap.js is the ONLY caller of this. Never call it
// per-request; see that file's daily-cache logic. ────────────────────────────
export const getPlayers = (sport) => sleeperFetch(`/players/${sport}`)
