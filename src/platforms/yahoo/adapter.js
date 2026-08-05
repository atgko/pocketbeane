// Wraps the existing Yahoo sync logic (pages/api/yahoo/*.js) behind the
// PlatformAdapter interface. Zero behavior change: every function imported
// below is the exact same parsing logic that shipped before this file
// existed, just extracted so it's callable directly instead of only
// reachable via an HTTP round-trip to its own route. The routes themselves
// (pages/api/yahoo/*.js) are untouched in their external HTTP contract —
// same URLs, same request/response shapes — see the "Core sync logic,
// extracted..." comment atop each of those files.
//
// Yahoo's auth is a per-request HttpOnly cookie
// (src/utils/yahooAuth.js's getValidToken(req, res)), so this adapter is a
// factory that closes over the current request's {req, res} — see
// src/platforms/index.js's getPlatform() for why.

import { getValidToken } from '@/utils/yahooAuth'
import { syncRosters } from '../../../pages/api/yahoo/sync-rosters'
import { syncDraft } from '../../../pages/api/yahoo/sync-draft'
import { fetchSettings } from '../../../pages/api/yahoo/settings'
import { fetchMyLeagues } from '../../../pages/api/yahoo/my-leagues'

const SUPPORTED_SPORTS = ['nba', 'mlb', 'nhl', 'nfl']

export function createYahooAdapter({ req, res } = {}) {
  async function requireToken() {
    if (!req || !res) {
      throw new Error('Yahoo adapter requires a Next.js {req, res} context (see getPlatform(id, {req, res}))')
    }
    const token = await getValidToken(req, res)
    if (!token) throw new Error('Not connected to Yahoo')
    return token
  }

  return {
    id: 'yahoo',
    requiresAuth: true,
    supportedSports: SUPPORTED_SPORTS,

    async getUserLeagues(userRef, sport, season) {
      const token = await requireToken()
      const { leagues } = await fetchMyLeagues(token, { sport })
      // fetchMyLeagues already filters to the latest season server-side;
      // `season` is accepted for interface parity with Sleeper (which
      // requires it) but Yahoo's endpoint doesn't take a season param.
      return season ? leagues.filter((l) => String(l.season) === String(season)) : leagues
    },

    async getLeague(leagueId) {
      const token = await requireToken()
      const settings = await fetchSettings(token, { leagueKey: leagueId })
      return {
        leagueKey: leagueId,
        leagueId,
        name: settings?.leagueName ?? leagueId,
        numTeams: settings?.numTeams ?? null,
        season: null, // not returned by settings.js; callers already have it from getUserLeagues
        settings,
      }
    },

    async getRosters(leagueId, sport = 'nba') {
      const token = await requireToken()
      return syncRosters(token, { leagueKey: leagueId, sport })
    },

    async getLeagueUsers(leagueId, sport = 'nba') {
      // Yahoo never modeled managers as a first-class resource separate
      // from the per-team `manager` nickname already parsed in
      // syncRosters — derive from that instead of a new Yahoo call.
      const { teams } = await this.getRosters(leagueId, sport)
      return teams.map((t) => ({
        userId: t.teamKey,
        displayName: t.manager,
        teamName: t.teamName,
        isOwner: true,
      }))
    },

    async getMatchups() {
      // Not extracted from matchup-advice.js's ad-hoc scoreboard parsing in
      // this pass — nothing outside that route currently needs a
      // standalone getMatchups() call, and matchup-advice.js itself is
      // explicitly not being touched (see plan's "Explicitly not touching").
      throw new Error('getMatchups is not implemented for the Yahoo adapter yet — matchup-advice.js has its own unextracted scoreboard parsing')
    },

    async getTransactions() {
      // No existing Yahoo transactions sync anywhere in the codebase to
      // wrap (see types.js's NormalizedTransaction comment) — plumbing only.
      return []
    },

    async getDraft(leagueId) {
      const token = await requireToken()
      const settings = await fetchSettings(token, { leagueKey: leagueId })
      return {
        draftId: leagueId, // Yahoo has no separate draft resource — the league key doubles as the draft's identity
        status: settings?.seasonOver ? 'complete' : 'unknown', // Yahoo doesn't expose a direct draft-status field through settings.js
        type: settings?.draftType ?? 'snake',
        draftOrder: {},
      }
    },

    async getDraftPicks(leagueId, sport = 'nba') {
      const token = await requireToken()
      return syncDraft(token, { leagueKey: leagueId, sport })
    },

    async getState() {
      // Yahoo has no sport-wide state endpoint independent of a league
      // (current_week is fetched per-league, ad hoc, in matchup-advice.js,
      // which this pass isn't touching). Nothing calls adapter.getState()
      // for Yahoo yet.
      throw new Error('getState is not implemented for the Yahoo adapter — Yahoo has no sport-wide state endpoint, only per-league current_week')
    },
  }
}
