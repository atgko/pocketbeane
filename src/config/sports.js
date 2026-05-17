// Sport config registry — the single source of truth for all sport-specific logic.
// Adding a new sport means adding one entry here plus a data file; no other code changes.
export const SPORT_CONFIGS = {
  nba: {
    id: 'nba',
    label: 'NBA',

    // Position buttons shown in the draft board filter bar
    filterPositions: ['PG', 'SG', 'G', 'SF', 'PF', 'F', 'C'],

    // Roster slot definitions in display order.
    // configKey is the key name in league.config for this slot's count.
    // max is the upper bound shown in the slot count picker (defaults to 3).
    slotOrder: [
      { type: 'PG',   configKey: 'pgSlots',   default: 1 },
      { type: 'SG',   configKey: 'sgSlots',   default: 1 },
      { type: 'G',    configKey: 'gSlots',    default: 1 },
      { type: 'SF',   configKey: 'sfSlots',   default: 1 },
      { type: 'PF',   configKey: 'pfSlots',   default: 1 },
      { type: 'F',    configKey: 'fSlots',    default: 1 },
      { type: 'C',    configKey: 'cSlots',    default: 1 },
      { type: 'UTIL', configKey: 'utilSlots', default: 2, max: 4 },
      { type: 'BN',   configKey: 'bnSlots',   default: 4, max: 6 },
    ],

    // Maps flexible slot types to the base positions that qualify for them.
    // Order matters: earlier entries win slot-matching priority over later entries.
    slotEligibility: {
      G:    ['PG', 'SG'],
      F:    ['SF', 'PF'],
      UTIL: ['PG', 'SG', 'SF', 'PF', 'C'],
    },

    categories: [
      { id: 'pts',      label: 'PTS', description: 'Points' },
      { id: 'reb',      label: 'REB', description: 'Rebounds' },
      { id: 'ast',      label: 'AST', description: 'Assists' },
      { id: 'stl',      label: 'STL', description: 'Steals' },
      { id: 'blk',      label: 'BLK', description: 'Blocks' },
      { id: 'to',       label: 'TO',  description: 'Turnovers' },
      { id: 'fg_pct',   label: 'FG%', description: 'Field Goal %' },
      { id: 'ft_pct',   label: 'FT%', description: 'Free Throw %' },
      { id: 'three_pm', label: '3PM', description: '3-Pointers Made' },
    ],

    // Category IDs that aggregate by average instead of sum
    percentageCategories: ['fg_pct', 'ft_pct'],

    benchmarks: {
      pts: 20.0, reb: 7.5,  ast: 5.0,   stl: 1.2,
      blk: 0.8,  to: 2.8,   fg_pct: 0.470, ft_pct: 0.780, three_pm: 1.8,
    },

    defaultRosterConfig: {
      pgSlots: 1, sgSlots: 1, gSlots: 1,
      sfSlots: 1, pfSlots: 1, fSlots: 1,
      cSlots: 1,  utilSlots: 2, bnSlots: 4,
      ilSlots: 1, ilPlusSlots: 0,
    },
  },

  // Future sports — add an entry here when ready:
  //
  // nhl: {
  //   id: 'nhl', label: 'NHL',
  //   filterPositions: ['C', 'LW', 'RW', 'W', 'D', 'G'],
  //   slotOrder: [...],
  //   slotEligibility: { W: ['LW', 'RW'], UTIL: ['C', 'LW', 'RW', 'D'], ... },
  //   categories: [...],
  //   percentageCategories: ['sv_pct'],
  //   ...
  // },
  //
  // nfl: {
  //   id: 'nfl', label: 'NFL',
  //   filterPositions: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
  //   slotOrder: [...],
  //   slotEligibility: { FLEX: ['RB', 'WR', 'TE'], ... },
  //   categories: [...],
  //   percentageCategories: [],
  //   ...
  // },
  //
  // mlb: {
  //   id: 'mlb', label: 'MLB',
  //   filterPositions: ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP'],
  //   slotOrder: [...],
  //   slotEligibility: { UTIL: [...], ... },
  //   categories: [...],
  //   percentageCategories: ['avg', 'era', 'whip'],
  //   ...
  // },
}

export function getSportConfig(sport) {
  return SPORT_CONFIGS[sport] ?? SPORT_CONFIGS.nba
}
