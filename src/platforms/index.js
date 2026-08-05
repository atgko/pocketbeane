// The platform-adapter registry. Downstream features (Season Hub, draft
// board, trade analyzer, League Pulse) should call ONLY through an adapter
// obtained here — never reach into pages/api/yahoo/* or a future
// pages/api/sleeper/* directly from feature code. See
// C:\Users\athav\.claude\plans\this-is-a-new-generic-tower.md for the full
// build rationale.
//
// Every PlatformAdapter method is documented in ./types.js.
//
// One deliberate departure from a "pure" adapter interface: Yahoo's auth is
// an HttpOnly cookie tied to the current Next.js req/res
// (src/utils/yahooAuth.js's getValidToken(req, res)) — there's no
// standalone token object to hand an adapter constructed ahead of time.
// getPlatform() therefore takes an optional `context` (Next.js API route's
// {req, res}) that platforms needing per-request auth can close over.
// Sleeper ignores it entirely (requiresAuth: false — see sleeper/adapter.js).

import { createYahooAdapter } from './yahoo/adapter'
import { createSleeperAdapter } from './sleeper/adapter'

export const PLATFORM_IDS = ['yahoo', 'sleeper']

const FACTORIES = {
  yahoo: createYahooAdapter,
  sleeper: createSleeperAdapter,
}

/**
 * @param {import('./types').PlatformId} id
 * @param {{req?: import('next').NextApiRequest, res?: import('next').NextApiResponse}} [context]
 * @returns {PlatformAdapter}
 */
export function getPlatform(id, context = {}) {
  const factory = FACTORIES[id]
  if (!factory) throw new Error(`Unknown platform: ${id}`)
  return factory(context)
}

/**
 * The contract every platform adapter implements. Both yahoo/adapter.js and
 * sleeper/adapter.js conform to this exactly — downstream code should never
 * need to branch on `adapter.id` to know which method to call, only to
 * decide things like whether to show an OAuth "Connect" button
 * (`requiresAuth`) or a "Data provided by Sleeper" attribution line.
 *
 * @typedef {Object} PlatformAdapter
 * @property {import('./types').PlatformId} id
 * @property {boolean} requiresAuth
 * @property {string[]} supportedSports - e.g. yahoo: ['nba','mlb','nhl','nfl'], sleeper: ['nfl'] (see BACKLOG/memory for why Sleeper is NFL-only)
 *
 * @property {(userRef: string, sport: string, season: string|number) => Promise<import('./types').NormalizedLeague[]>} getUserLeagues
 * @property {(leagueId: string) => Promise<import('./types').NormalizedLeague>} getLeague
 * @property {(leagueId: string) => Promise<import('./types').NormalizedRostersResponse>} getRosters
 * @property {(leagueId: string) => Promise<import('./types').NormalizedManager[]>} getLeagueUsers
 * @property {(leagueId: string, week: number) => Promise<import('./types').NormalizedMatchup[]>} getMatchups
 * @property {(leagueId: string, week: number) => Promise<import('./types').NormalizedTransaction[]>} getTransactions
 * @property {(draftId: string) => Promise<import('./types').NormalizedDraft>} getDraft
 * @property {(draftId: string) => Promise<import('./types').NormalizedDraftPicksResponse>} getDraftPicks
 * @property {(sport: string) => Promise<import('./types').NormalizedState>} getState
 */
