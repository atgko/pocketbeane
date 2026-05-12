import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CATEGORIES } from '@/constants/categories'
import { DEFAULT_ROSTER_SLOTS } from '@/constants/positions'

export const DEFAULT_CONFIG = {
  name: '',
  numTeams: 10,
  draftPosition: 1,
  categories: DEFAULT_CATEGORIES,
  ilSlots: 1,
  ilType: 'standard',      // 'standard' | 'il_plus'
  draftType: 'snake',      // 'snake' | 'auction' (auction = future)
  scoringFormat: '9cat',   // '9cat' | '8cat' | 'points' (non-9cat = future)
}

const makeLeague = (config) => ({
  id: `league-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  config: { ...DEFAULT_CONFIG, ...config },
  status: 'drafting',
  draft: { picks: [] },
  rosterSlots: { ...DEFAULT_ROSTER_SLOTS },
})

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
              : { ...l, draft: { picks: [] }, rosterSlots: { ...DEFAULT_ROSTER_SLOTS } }
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
