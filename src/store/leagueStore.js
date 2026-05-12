import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CATEGORIES } from '@/constants/categories'

export const DEFAULT_CONFIG = {
  name: '',
  numTeams: 10,
  draftPosition: 1,
  categories: DEFAULT_CATEGORIES,
  // roster slot counts
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
  draftType: 'snake',      // 'snake' | 'auction' (auction = future)
  scoringFormat: '9cat',   // '9cat' | '8cat' | 'points' (non-9cat = future)
}

// Returns [{ type, playerId: null }, ...] in display order
function generateRosterSlots(config) {
  const slots = []
  const add = (type, count) => {
    for (let i = 0; i < count; i++) slots.push({ type, playerId: null })
  }
  add('PG',   config.pgSlots)
  add('SG',   config.sgSlots)
  add('G',    config.gSlots)
  add('SF',   config.sfSlots)
  add('PF',   config.pfSlots)
  add('F',    config.fSlots)
  add('C',    config.cSlots)
  add('UTIL', config.utilSlots)
  add('BN',   config.bnSlots)
  return slots
}

const makeLeague = (config) => {
  const merged = { ...DEFAULT_CONFIG, ...config }
  return {
    id: `league-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    config: merged,
    status: 'drafting',
    // Pick shape: { playerId, pickNumber, draftedBy: 'user' | 'opponent' }
    draft: { picks: [] },
    rosterSlots: generateRosterSlots(merged),
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

      resetDraft: (id) =>
        set((state) => ({
          leagues: state.leagues.map((l) =>
            l.id !== id
              ? l
              : { ...l, draft: { picks: [] }, rosterSlots: generateRosterSlots(l.config) }
          ),
        })),

      getLeague: (id) => get().leagues.find((l) => l.id === id) ?? null,

      getActiveLeague: () => {
        const { leagues, activeLeagueId } = get()
        return leagues.find((l) => l.id === activeLeagueId) ?? leagues[0] ?? null
      },
    }),
    { name: 'pocketbeane-v2' }
  )
)

export default useLeagueStore
