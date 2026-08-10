// Normalized shapes shared by every platform adapter (yahoo/adapter.js,
// sleeper/adapter.js). These are NOT new shapes — they document what
// pages/api/yahoo/{sync-rosters,sync-draft,settings,my-leagues}.js already
// return today. Field names are kept exactly as-is (including
// Yahoo-flavored ones like `yahooTeam`) on purpose: downstream consumers
// (src/components/season/*, src/components/draft/*, src/ai/*) already read
// these exact field names, and the whole point of this layer is that they
// need zero changes when a league's data comes from Sleeper instead of
// Yahoo. Don't "clean up" a field name here without updating every reader.
//
// This is a plain-JS project (no TypeScript) — these are JSDoc typedefs for
// editor hints and documentation, not runtime-enforced.

/**
 * @typedef {'yahoo' | 'sleeper'} PlatformId
 */

/**
 * @typedef {'9cat' | '8cat' | 'points'} ScoringFormat
 * Mirrors leagueStore.js's DEFAULT_CONFIG.scoringFormat. 'points' is read by
 * the points-value engine (src/ai/valueCalculator.js etc.) added alongside
 * this platform work — see documentation/BACKLOG.md NFL-01 for why Yahoo NFL leagues stay
 * on the 'points'-as-single-category shim instead of switching over.
 */

/**
 * One roster slot on a team, as returned by sync-rosters.js today.
 * @typedef {Object} NormalizedRosterPlayer
 * @property {string|null} playerKey   - Platform-native player identifier (Yahoo player_key or Sleeper player_id, kept as a string either way)
 * @property {string|null} name
 * @property {string|null} playerId    - PocketBeane's own id (src/data/*.json), resolved by name-matching (Yahoo) or player_id cross-reference (Sleeper) — null if unmatched
 * @property {string|null} positions   - Yahoo-style display position string, e.g. "PG,SG"
 * @property {string|null} yahooTeam   - Real-world team abbreviation (e.g. "DEN"). Name kept as-is — see file header.
 * @property {string} status           - 'active' | 'IR' | etc.
 * @property {string|null} selectedPosition - Roster slot this player currently fills (e.g. "UTIL", "BN")
 */

/**
 * One team/roster within a league, as returned by sync-rosters.js today.
 * @typedef {Object} NormalizedRoster
 * @property {string} teamKey
 * @property {string} teamName
 * @property {string|null} manager
 * @property {number|null} rank
 * @property {number} wins
 * @property {number} losses
 * @property {number} ties
 * @property {boolean} isUser
 * @property {NormalizedRosterPlayer[]} roster
 */

/**
 * getRosters() response envelope — matches sync-rosters.js's top-level JSON.
 * @typedef {Object} NormalizedRostersResponse
 * @property {NormalizedRoster[]} teams
 * @property {string|null} userTeamKey
 * @property {number} matched
 * @property {number} total
 * @property {boolean} isSeasonOver
 * @property {string} syncedAt - ISO timestamp
 */

/**
 * A league entry as listed for a user, matching my-leagues.js today.
 * getLeague(leagueId) returns this shape with `settings` populated (a
 * getLeague() call needs the fuller settings.js-style detail; the
 * lightweight getUserLeagues() listing may leave `settings` null since
 * the brief's interface doesn't call for a separate getSettings method —
 * league settings live here instead of as their own adapter method).
 * @typedef {Object} NormalizedLeague
 * @property {string} leagueKey  - Platform-native league identifier (Yahoo league_key, or Sleeper league_id)
 * @property {string} leagueId
 * @property {string} name
 * @property {number} numTeams
 * @property {string|number} season
 * @property {NormalizedLeagueSettings|null} [settings]
 * @property {string|null} [draftId] - Sleeper only: the league's draft resource id (Sleeper's draft isn't addressable by leagueId — Yahoo has no separate draft resource, so this is always null there)
 */

/**
 * A league manager/user, matching the `manager` string sync-rosters.js
 * embeds per team today. Kept as a distinct type since Sleeper's
 * /league/<id>/users endpoint returns managers as first-class objects
 * (useful for a future manager-identity feature), but the adapter should
 * still flatten this onto NormalizedRoster.manager for zero-change parity.
 * @typedef {Object} NormalizedManager
 * @property {string} userId
 * @property {string|null} displayName
 * @property {string|null} teamName
 * @property {boolean} isOwner
 */

/**
 * League settings, matching settings.js today.
 * @typedef {Object} NormalizedLeagueSettings
 * @property {Array<{id: string|number, name: string, higherIsBetter: boolean}>} statCategories
 * @property {Array<{position: string, count: number, isStarter: boolean}>} rosterPositions
 * @property {number|null} numTeams
 * @property {string|null} leagueName
 * @property {string|null} draftType   - 'snake' | 'auction'
 * @property {number|null} auctionBudget
 * @property {string|null} scoringType - Yahoo's 'head'|'roto'|'points'|null; Sleeper leagues normalize to 'points' or 'head' depending on scoring_settings
 */

/**
 * A single draft pick, matching sync-draft.js's `picks[]` entries today.
 * @typedef {Object} NormalizedPick
 * @property {number} pickNumber
 * @property {number} round
 * @property {string|null} playerId    - PocketBeane id, null if unmatched
 * @property {string|null} playerName
 * @property {'user'|'opponent'} draftedBy
 */

/**
 * getDraftPicks() response envelope — matches sync-draft.js's top-level JSON.
 * @typedef {Object} NormalizedDraftPicksResponse
 * @property {NormalizedPick[]} picks
 * @property {string|null} userTeamKey
 * @property {number|null} draftPosition
 * @property {number} matched
 * @property {number} total
 */

/**
 * A single matchup between two teams for a given week. No Yahoo shape
 * exists for this today (matchup-advice.js parses Yahoo's scoreboard JSON
 * ad hoc, never persisted as a typed model) — this is the first formal
 * shape for it, written to match what that ad-hoc parsing already produces.
 * @typedef {Object} NormalizedMatchup
 * @property {number} week
 * @property {string} matchupId       - Teams sharing this id play each other
 * @property {string} teamKey
 * @property {number|null} points     - Total points scored (points leagues) or null (category leagues report per-category, not modeled here yet)
 */

/**
 * A transaction (trade/waiver/free-agent move). Not synced or modeled for
 * Yahoo anywhere in the codebase today — this shape exists so the
 * PlatformAdapter interface is complete and forward-compatible, but nothing
 * downstream consumes it yet. Not a UI deliverable in this scope.
 * @typedef {Object} NormalizedTransaction
 * @property {string} transactionId
 * @property {string} type            - 'trade' | 'waiver' | 'free_agent'
 * @property {number} week
 * @property {string} status
 */

/**
 * Draft metadata, matching what sync-draft.js implicitly assumes
 * (userTeamKey + draftPosition) plus Sleeper's richer draft_order/
 * slot_to_roster_id, which the adapter should also expose since the
 * upcoming live-draft-polling step needs it.
 * @typedef {Object} NormalizedDraft
 * @property {string} draftId
 * @property {string} status          - 'pre_draft' | 'drafting' | 'complete'
 * @property {string} type            - 'snake' | 'auction'
 * @property {Object.<string, number>} draftOrder - userId -> slot
 */

/**
 * Current season/week state for a sport, matching Yahoo's ad hoc
 * `current_week` lookup in matchup-advice.js and Sleeper's /state/<sport>.
 * @typedef {Object} NormalizedState
 * @property {number} week
 * @property {string|number} season
 * @property {string} seasonType      - e.g. 'pre' | 'regular' | 'post' | 'off'
 * @property {boolean} isSeasonOver
 */

// No runtime exports needed — this file is JSDoc-only documentation, per
// the project's plain-JS convention (see src/config/sports.js for the same
// "config object as source of truth, JSDoc for shape" pattern).
export {}
