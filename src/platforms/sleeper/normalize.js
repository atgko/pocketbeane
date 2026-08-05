// Sleeper JSON -> PocketBeane's normalized shapes (src/platforms/types.js).
// Field names on the output are deliberately Yahoo-flavored where types.js
// says so (e.g. `yahooTeam`) — see that file's header for why.

import fs from 'fs'
import path from 'path'
import { getPlayerFile } from '@/config/sports'

// Same name-normalization PocketBeane already uses to match Yahoo rosters
// to src/data/nfl_players.json (pages/api/yahoo/sync-rosters.js) — kept as
// its own copy here rather than extracted into a shared util, so this pass
// doesn't touch already-verified Yahoo files for a DRY-only refactor.
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

let cachedNameToId = null
function nameToPocketBeaneId(fullName) {
  if (!fullName) return null
  if (!cachedNameToId) {
    const playersPath = path.join(process.cwd(), 'src/data', getPlayerFile('nfl'))
    const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'))
    cachedNameToId = {}
    for (const p of players) cachedNameToId[normalizeName(p.name)] = p.id
  }
  return cachedNameToId[normalizeName(fullName)] ?? null
}

function playerFullName(sleeperPlayerOrMetadata) {
  if (!sleeperPlayerOrMetadata) return null
  return (
    sleeperPlayerOrMetadata.full_name ??
    `${sleeperPlayerOrMetadata.first_name ?? ''} ${sleeperPlayerOrMetadata.last_name ?? ''}`.trim() ??
    null
  ) || null
}

// ─── League + settings ──────────────────────────────────────────────────────

export function normalizeLeague(sleeperLeague) {
  if (!sleeperLeague) return null
  return {
    leagueKey: sleeperLeague.league_id,
    leagueId: sleeperLeague.league_id,
    name: sleeperLeague.name,
    numTeams: sleeperLeague.total_rosters,
    season: sleeperLeague.season,
    settings: normalizeSettings(sleeperLeague),
    draftId: sleeperLeague.draft_id ?? null,
  }
}

// Sleeper NFL leagues are points/PPR by default — the API doesn't support
// category-scored NFL leagues at all (see memory
// project_sleeper_integration_scope), so this always resolves to 'points'.
// Kept as its own function (rather than a hardcoded literal) so a future
// non-NFL Sleeper sport — if the API ever opens that up — has an obvious
// place to add real category-format detection instead of silently
// inheriting NFL's assumption.
export function detectScoringFormat(_sleeperLeague) {
  return 'points'
}

function normalizeSettings(sleeperLeague) {
  const rosterPositions = (sleeperLeague.roster_positions ?? []).reduce((acc, pos) => {
    if (pos === 'BN') return acc
    const existing = acc.find((p) => p.position === pos)
    if (existing) existing.count += 1
    else acc.push({ position: pos, count: 1, isStarter: true })
    return acc
  }, [])

  return {
    // scoring_settings is a flat {stat_key: pointWeight} map — field names
    // verified live against a real Sleeper NFL league in Phase 0 (e.g.
    // pass_yd, pass_td, rec, rec_yd, ...), not just from docs.
    statCategories: Object.entries(sleeperLeague.scoring_settings ?? {}).map(([id, weight]) => ({
      id,
      name: id,
      higherIsBetter: weight >= 0,
    })),
    rosterPositions,
    numTeams: sleeperLeague.total_rosters ?? null,
    leagueName: sleeperLeague.name ?? null,
    // Sleeper doesn't expose snake-vs-auction on the league resource itself
    // — that's on the draft resource's `type` field (see normalizeDraft).
    // Left null here rather than guessing; callers needing draft type
    // should read it from getDraft(), same as Yahoo's settings.js leaves
    // draftType null when Yahoo doesn't report one.
    draftType: null,
    // Not verified against a real Sleeper auction league in Phase 0 (only
    // a snake league was positive-controlled) — left null rather than
    // guessing an unverified field name/shape. Populate once a real
    // Sleeper NFL auction league is available to test against.
    auctionBudget: null,
    scoringType: detectScoringFormat(sleeperLeague),
  }
}

// ─── Rosters ─────────────────────────────────────────────────────────────────

// Sleeper's convention (used by its own web client, not spelled out
// explicitly in the docs the brief quoted): starters[i] fills the slot at
// roster_positions[i] — both arrays are positionally ordered. Not verified
// against a live response in Phase 0 (only roster counts were
// positive-controlled). Confirm against a real Sleeper NFL roster before
// leaning on this for anything beyond the IL-stash cosmetic tag.
function selectedPositionFor(playerId, starters, rosterPositions) {
  const idx = (starters ?? []).indexOf(playerId)
  if (idx === -1) return 'BN'
  return rosterPositions?.[idx] ?? 'BN'
}

export function normalizeRosters(sleeperRosters, sleeperUsers, sleeperLeague, playerMap, userRosterId) {
  const userByOwnerId = new Map((sleeperUsers ?? []).map((u) => [u.user_id, u]))
  const rosterPositions = sleeperLeague?.roster_positions ?? []

  const teams = (sleeperRosters ?? []).map((r) => {
    const owner = userByOwnerId.get(r.owner_id)
    const roster = (r.players ?? []).map((playerId) => {
      const sp = playerMap?.[playerId]
      const fullName = playerFullName(sp)
      return {
        playerKey: playerId,
        name: fullName,
        playerId: nameToPocketBeaneId(fullName),
        positions: sp?.fantasy_positions?.join(',') ?? sp?.position ?? null,
        yahooTeam: sp?.team ?? null,
        status: sp?.injury_status || 'active',
        selectedPosition: selectedPositionFor(playerId, r.starters, rosterPositions),
      }
    })

    return {
      teamKey: String(r.roster_id),
      teamName: owner?.metadata?.team_name ?? owner?.display_name ?? `Team ${r.roster_id}`,
      manager: owner?.display_name ?? null,
      // Sleeper doesn't return a precomputed standings rank on the rosters
      // endpoint — would need to be derived client-side from wins/points if
      // a ranked list is needed; left null rather than fabricating one,
      // same gap Yahoo's sync-rosters.js has when standings data is absent.
      rank: null,
      wins: r.settings?.wins ?? 0,
      losses: r.settings?.losses ?? 0,
      ties: r.settings?.ties ?? 0,
      isUser: userRosterId != null && r.roster_id === userRosterId,
      roster,
    }
  })

  return {
    teams,
    userTeamKey: userRosterId != null ? String(userRosterId) : null,
    matched: teams.reduce((sum, t) => sum + t.roster.filter((p) => p.playerId).length, 0),
    total: teams.reduce((sum, t) => sum + t.roster.length, 0),
    // Sleeper doesn't 403 league-scoped calls once a season ends the way
    // Yahoo does — season-over detection here should come from
    // getState('nfl')'s season_type ('off'), not this call. Always false;
    // the adapter's getState() is the real signal.
    isSeasonOver: false,
    syncedAt: new Date().toISOString(),
  }
}

// ─── Managers ────────────────────────────────────────────────────────────────

export function normalizeManagers(sleeperUsers) {
  return (sleeperUsers ?? []).map((u) => ({
    userId: u.user_id,
    displayName: u.display_name ?? null,
    teamName: u.metadata?.team_name ?? null,
    isOwner: Boolean(u.is_owner),
  }))
}

// ─── Matchups / transactions ────────────────────────────────────────────────

export function normalizeMatchups(sleeperMatchups, week) {
  return (sleeperMatchups ?? []).map((m) => ({
    week,
    matchupId: String(m.matchup_id),
    teamKey: String(m.roster_id),
    points: m.points ?? null,
  }))
}

export function normalizeTransactions(sleeperTransactions, week) {
  return (sleeperTransactions ?? []).map((t) => ({
    transactionId: String(t.transaction_id),
    type: t.type,
    week,
    status: t.status,
  }))
}

// ─── Draft ───────────────────────────────────────────────────────────────────

export function normalizeDraft(sleeperDraft) {
  return {
    draftId: sleeperDraft.draft_id,
    status: sleeperDraft.status,
    type: sleeperDraft.type ?? 'snake',
    draftOrder: sleeperDraft.draft_order ?? {},
  }
}

export function normalizeDraftPicks(sleeperPicks, sleeperDraft, userId) {
  const userSlot = sleeperDraft?.draft_order?.[userId] ?? null
  const userRosterId = userSlot != null ? sleeperDraft?.slot_to_roster_id?.[userSlot] ?? null : null

  const picks = (sleeperPicks ?? []).map((p) => {
    // Picks carry a metadata snapshot (position/team/injury_status/
    // first_name/last_name) independent of the live player map — use it as
    // a fallback if a player was somehow dropped from /players/nfl (e.g.
    // retired) between the pick and this read.
    const fullName = playerFullName(p.metadata)
    return {
      pickNumber: p.pick_no,
      round: p.round,
      playerId: nameToPocketBeaneId(fullName),
      playerName: fullName,
      draftedBy: userRosterId != null && p.roster_id === userRosterId ? 'user' : 'opponent',
    }
  })

  return {
    picks,
    userTeamKey: userRosterId != null ? String(userRosterId) : null,
    draftPosition: userSlot ?? null,
    matched: picks.filter((p) => p.playerId).length,
    total: picks.length,
  }
}

// ─── State ───────────────────────────────────────────────────────────────────

export function normalizeState(sleeperState) {
  return {
    week: sleeperState?.week ?? 0,
    season: sleeperState?.season ?? null,
    seasonType: sleeperState?.season_type ?? 'unknown',
    isSeasonOver: sleeperState?.season_type === 'off',
  }
}
