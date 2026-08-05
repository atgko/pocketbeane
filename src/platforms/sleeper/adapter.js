// Implements the PlatformAdapter interface (src/platforms/index.js) for
// Sleeper. No auth — requiresAuth: false — so unlike yahoo/adapter.js this
// doesn't need a Next.js {req, res} context to read a cookie. It does still
// need to know *which* Sleeper user is asking (to compute isUser/
// userTeamKey on rosters and draftedBy on picks), since Sleeper has no
// session to infer that from the way Yahoo's OAuth token implicitly does —
// so `userId` is passed the same way Yahoo's {req, res} is: via
// getPlatform('sleeper', { userId }). This is the *Sleeper user_id*
// (resolved once at onboarding and stored — see the onboarding flow),
// never the mutable username.
//
// NFL only — see memory project_sleeper_integration_scope for why (Sleeper's
// league/draft discovery endpoints are documented and empirically confirmed
// NFL-only as of Phase 0, 2026-08-04).

import {
  getUser,
  getUserLeagues as fetchUserLeagues,
  getLeague as fetchLeague,
  getLeagueRosters,
  getLeagueUsers as fetchLeagueUsers,
  getLeagueMatchups,
  getLeagueTransactions,
  getDraft as fetchDraft,
  getDraftPicks as fetchDraftPicks,
  getState as fetchState,
} from './client'
import { getPlayerMap } from './playerMap'
import {
  normalizeLeague,
  normalizeRosters,
  normalizeManagers,
  normalizeMatchups,
  normalizeTransactions,
  normalizeDraft,
  normalizeDraftPicks,
  normalizeState,
} from './normalize'

const SUPPORTED_SPORTS = ['nfl']

function assertNflOnly(sport) {
  if (sport && !SUPPORTED_SPORTS.includes(sport)) {
    throw new Error(`Sleeper adapter only supports NFL (requested: ${sport}) — see memory project_sleeper_integration_scope`)
  }
}

export function createSleeperAdapter({ userId } = {}) {
  return {
    id: 'sleeper',
    requiresAuth: false,
    supportedSports: SUPPORTED_SPORTS,

    async getUserLeagues(userRef, sport = 'nfl', season) {
      assertNflOnly(sport)
      const leagues = await fetchUserLeagues(userRef, sport, season)
      return (leagues ?? []).map(normalizeLeague)
    },

    async getLeague(leagueId) {
      const league = await fetchLeague(leagueId)
      return normalizeLeague(league)
    },

    async getRosters(leagueId) {
      const [rosters, users, league, playerMap] = await Promise.all([
        getLeagueRosters(leagueId),
        fetchLeagueUsers(leagueId),
        fetchLeague(leagueId),
        getPlayerMap(),
      ])
      const userRosterId = userId != null
        ? rosters?.find((r) => r.owner_id === userId)?.roster_id ?? null
        : null
      return normalizeRosters(rosters, users, league, playerMap, userRosterId)
    },

    async getLeagueUsers(leagueId) {
      const users = await fetchLeagueUsers(leagueId)
      return normalizeManagers(users)
    },

    async getMatchups(leagueId, week) {
      const matchups = await getLeagueMatchups(leagueId, week)
      return normalizeMatchups(matchups, week)
    },

    async getTransactions(leagueId, week) {
      const transactions = await getLeagueTransactions(leagueId, week)
      return normalizeTransactions(transactions, week)
    },

    async getDraft(draftId) {
      const draft = await fetchDraft(draftId)
      return normalizeDraft(draft)
    },

    async getDraftPicks(draftId) {
      const [picks, draft] = await Promise.all([fetchDraftPicks(draftId), fetchDraft(draftId)])
      return normalizeDraftPicks(picks, draft, userId)
    },

    async getState(sport = 'nfl') {
      assertNflOnly(sport)
      const state = await fetchState(sport)
      return normalizeState(state)
    },

    // Not part of the PlatformAdapter interface (getUser/username
    // resolution is onboarding-specific, not a per-league data fetch) —
    // exposed here anyway since it's the one Sleeper identity operation
    // every consumer of this adapter needs and it'd otherwise mean
    // reaching past the adapter into client.js directly.
    async resolveUsername(username) {
      return getUser(username)
    },
  }
}
