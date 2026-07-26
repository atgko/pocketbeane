import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getSportConfig } from '@/config/sports'

export const DEFAULT_PHILOSOPHY = {
  strategy: 'beane',           // 'beane' | 'balanced' | 'stars-and-scrubs' | 'punt'
  puntCategories: [],           // cat IDs to deprioritize (strategy === 'punt' only)
  injuryTolerance: 'moderate', // 'conservative' | 'moderate' | 'aggressive'
}

export const DEFAULT_CONFIG = {
  name: '',
  sport: 'nba',
  numTeams: 10,
  draftPosition: 1,
  categories: getSportConfig('nba').categories.map(c => c.id),
  // roster slot counts — key names are sport-specific (see SPORT_CONFIGS[sport].slotOrder)
  pgSlots: 1,
  sgSlots: 1,
  gSlots: 1,
  sfSlots: 1,
  pfSlots: 1,
  fSlots: 1,
  cSlots: 1,
  utilSlots: 2,
  bnSlots: 4,
  // IL slots are post-draft only, not part of the draft roster
  ilSlots: 1,
  ilPlusSlots: 0,
  draftType: 'snake',      // 'snake' | 'auction'
  auctionBudget: 200,      // total budget per team (auction only), Yahoo default is $200
  scoringFormat: '9cat',   // '9cat' | '8cat' | 'points' (non-9cat = future)
  philosophy: { ...DEFAULT_PHILOSOPHY },
  // Yahoo-synced league settings — null until synced via setup page
  yahooLeagueKey: null,
  yahooStatCategories: null,   // [{ id, name, higherIsBetter }]
  yahooRosterPositions: null,  // [{ position, count, isStarter }]
}

// Returns [{ type, playerId: null }, ...] in display order
function generateRosterSlots(config) {
  const sportConfig = getSportConfig(config.sport)
  const slots = []
  for (const slot of sportConfig.slotOrder) {
    const count = config[slot.configKey] ?? slot.default
    for (let i = 0; i < count; i++) slots.push({ type: slot.type, playerId: null })
  }
  return slots
}

const DEFAULT_PROFILE_OVERRIDE = {
  hasOverride: false,
  injuryTolerance: null,
  categoryStrategy: null,
  draftStrategy: null,
}

const makeLeague = (config) => {
  const merged = { ...DEFAULT_CONFIG, ...config }
  return {
    id: `league-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    config: merged,
    status: 'drafting',
    // Pick shape: { playerId, pickNumber, draftedBy: 'user' | 'opponent', price: number | null }
    draft: { picks: [] },
    rosterSlots: generateRosterSlots(merged),
    profileOverride: { ...DEFAULT_PROFILE_OVERRIDE },
  }
}

const useLeagueStore = create(
  persist(
    (set, get) => ({
      leagues: [],
      activeLeagueId: null,

      createLeague: (config) => {
        const league = makeLeague(config)
        set((state) => ({
          leagues: [...state.leagues, league],
          activeLeagueId: league.id,
        }))
        return league.id
      },

      updateLeagueConfig: (id, config) =>
        set((state) => ({
          leagues: state.leagues.map((l) =>
            l.id === id ? { ...l, config: { ...l.config, ...config } } : l
          ),
        })),

      deleteLeague: (id) =>
        set((state) => {
          const leagues = state.leagues.filter((l) => l.id !== id)
          const activeLeagueId =
            state.activeLeagueId === id
              ? (leagues[0]?.id ?? null)
              : state.activeLeagueId
          return { leagues, activeLeagueId }
        }),

      setActiveLeague: (id) => set({ activeLeagueId: id }),

      setLeagueStatus: (id, status) =>
        set((state) => ({
          leagues: state.leagues.map((l) => (l.id === id ? { ...l, status } : l)),
        })),

      setDraftOutlook: (id, outlook) =>
        set((state) => ({
          leagues: state.leagues.map((l) => (l.id === id ? { ...l, draftOutlook: outlook } : l)),
        })),

      setDraftDNA: (id, dna) =>
        set((state) => ({
          leagues: state.leagues.map((l) => (l.id === id ? { ...l, draftDNA: dna } : l)),
        })),

      // Stashes the outgoing snapshot's per-team standing (rank/wins/losses/
      // ties, keyed by teamKey) as previousStandings before overwriting —
      // Team Pulse's trend arrow diffs the new sync against this. A league's
      // first-ever sync leaves previousStandings null (no prior data to
      // compare against, so no fabricated arrow).
      setLeagueRosters: (id, rosters) =>
        set((state) => ({
          leagues: state.leagues.map((l) => {
            if (l.id !== id) return l
            const previousStandings = l.leagueRosters?.teams
              ? Object.fromEntries(
                  l.leagueRosters.teams.map((t) => [
                    t.teamKey,
                    { rank: t.rank, wins: t.wins, losses: t.losses, ties: t.ties ?? null },
                  ])
                )
              : l.previousStandings ?? null
            return { ...l, leagueRosters: rosters, previousStandings }
          }),
        })),

      setProfileOverride: (id, override) =>
        set((state) => ({
          leagues: state.leagues.map((l) =>
            l.id === id ? { ...l, profileOverride: { ...DEFAULT_PROFILE_OVERRIDE, ...override } } : l
          ),
        })),

      addPick: (id, pick) =>
        set((state) => ({
          leagues: state.leagues.map((l) =>
            l.id !== id
              ? l
              : { ...l, draft: { picks: [...l.draft.picks, pick] } }
          ),
        })),

      undoPick: (id) =>
        set((state) => ({
          leagues: state.leagues.map((l) =>
            l.id !== id
              ? l
              : { ...l, draft: { picks: l.draft.picks.slice(0, -1) } }
          ),
        })),

      removePick: (id, playerId) =>
        set((state) => ({
          leagues: state.leagues.map((l) =>
            l.id !== id
              ? l
              : { ...l, draft: { picks: l.draft.picks.filter((p) => p.playerId !== playerId) } }
          ),
        })),

      reassignPick: (id, playerId, newDraftedBy) =>
        set((state) => ({
          leagues: state.leagues.map((l) =>
            l.id !== id
              ? l
              : {
                  ...l,
                  draft: {
                    picks: l.draft.picks.map((p) =>
                      p.playerId === playerId ? { ...p, draftedBy: newDraftedBy } : p
                    ),
                  },
                }
          ),
        })),

      resetDraft: (id) =>
        set((state) => ({
          leagues: state.leagues.map((l) =>
            l.id !== id
              ? l
              : { ...l, draft: { picks: [] }, rosterSlots: generateRosterSlots(l.config) }
          ),
        })),

      archiveLeague: (id) =>
        set((state) => ({
          leagues: state.leagues.map((l) => (l.id === id ? { ...l, status: 'complete' } : l)),
        })),

      importDraft: (id, picks, draftPosition) =>
        set((state) => ({
          leagues: state.leagues.map((l) => {
            if (l.id !== id) return l
            const validPicks = picks
              .filter((p) => p.playerId !== null)
              .map(({ playerId, pickNumber, draftedBy }) => ({
                playerId,
                pickNumber,
                draftedBy,
                price: null,
              }))
            const newConfig = {
              ...l.config,
              draftSynced: true,
              ...(draftPosition ? { draftPosition } : {}),
            }
            return { ...l, config: newConfig, draft: { picks: validPicks }, status: 'season' }
          }),
        })),

      getLeague: (id) => get().leagues.find((l) => l.id === id) ?? null,

      getActiveLeague: () => {
        const { leagues, activeLeagueId } = get()
        return leagues.find((l) => l.id === activeLeagueId) ?? leagues[0] ?? null
      },
    }),
    {
      name: 'pocketbeane-v2',
      version: 1,
      migrate: (state, version) => {
        if (version === 0) {
          // importDraft previously set status:'complete'; fix existing leagues to 'season'
          return {
            ...state,
            leagues: (state.leagues ?? []).map(l =>
              l.status === 'complete' && l.config?.draftSynced
                ? { ...l, status: 'season' }
                : l
            ),
          }
        }
        return state
      },
    }
  )
)

export default useLeagueStore
