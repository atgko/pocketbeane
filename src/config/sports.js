// Sport config registry — the single source of truth for all sport-specific logic.
// Adding a new sport means adding one entry here plus a data file; no other code changes.
export const SPORT_CONFIGS = {
  nba: {
    id: 'nba',
    label: 'NBA',

    // Player pool + schedule data files, relative to src/data/. Sports without
    // a scheduleFile don't support the Start/Sit Advisor yet (see
    // getScheduleFile/hasScheduleSupport below) — adding a sport there is a
    // pure data-file drop, no code changes.
    playerFile: 'players.json',
    scheduleFile: 'nba_schedule.json',
    // Back-to-back is a meaningful fatigue signal for this sport's start/sit
    // advisor (dense schedule, teams sometimes play on consecutive days).
    backToBackRelevant: true,

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
    // Lower is better for turnovers
    lowerIsBetter: ['to'],
  },

  mlb: {
    id: 'mlb',
    label: 'MLB',

    playerFile: 'mlb_players.json',
    scheduleFile: 'mlb_schedule.json',
    // Teams play near-daily — team-schedule density isn't a meaningful
    // fatigue signal here (unlike NBA/NHL), so the Start/Sit Advisor doesn't
    // surface back-to-back tags for this sport. Games-this-week is still
    // used as an approximate proxy for pitcher start count until real
    // probable-starts data exists (see BACKLOG Y-05c).
    backToBackRelevant: false,

    filterPositions: ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP'],

    slotOrder: [
      { type: 'C',    configKey: 'cSlots',      default: 1 },
      { type: '1B',   configKey: 'firstSlots',   default: 1 },
      { type: '2B',   configKey: 'secondSlots',  default: 1 },
      { type: '3B',   configKey: 'thirdSlots',   default: 1 },
      { type: 'SS',   configKey: 'ssSlots',      default: 1 },
      { type: 'OF',   configKey: 'ofSlots',      default: 3, max: 5 },
      { type: 'UTIL', configKey: 'utilSlots',    default: 1, max: 3 },
      { type: 'SP',   configKey: 'spSlots',      default: 2, max: 5 },
      { type: 'RP',   configKey: 'rpSlots',      default: 2, max: 5 },
      { type: 'BN',   configKey: 'bnSlots',      default: 5, max: 8 },
    ],

    // UTIL can hold any hitter; pitchers have their own SP/RP slots only
    slotEligibility: {
      UTIL: ['C', '1B', '2B', '3B', 'SS', 'OF'],
    },

    categories: [
      { id: 'r',    label: 'R',    description: 'Runs' },
      { id: 'hr',   label: 'HR',   description: 'Home Runs' },
      { id: 'rbi',  label: 'RBI',  description: 'RBI' },
      { id: 'sb',   label: 'SB',   description: 'Stolen Bases' },
      { id: 'avg',  label: 'AVG',  description: 'Batting Average' },
      { id: 'w',    label: 'W',    description: 'Wins' },
      { id: 'sv',   label: 'SV',   description: 'Saves' },
      { id: 'k',    label: 'K',    description: 'Strikeouts' },
      { id: 'era',  label: 'ERA',  description: 'Earned Run Average' },
      { id: 'whip', label: 'WHIP', description: 'WHIP' },
    ],

    // AVG, ERA, WHIP are rate stats — averaged across players, not summed
    percentageCategories: ['avg', 'era', 'whip'],
    lowerIsBetter: ['era', 'whip'],

    // Benchmarks represent a competitive team's expected totals at full draft
    // (season totals for counting stats; rate for avg/era/whip)
    benchmarks: {
      r: 1100, hr: 200, rbi: 950, sb: 100, avg: 0.265,
      w: 75, sv: 45, k: 1050, era: 3.90, whip: 1.28,
    },

    defaultRosterConfig: {
      cSlots: 1, firstSlots: 1, secondSlots: 1, thirdSlots: 1,
      ssSlots: 1, ofSlots: 3, utilSlots: 1,
      spSlots: 2, rpSlots: 2, bnSlots: 5,
    },
  },

  // Future sports — add an entry here when ready:
  //
  // nhl: {
  //   id: 'nhl', label: 'NHL',
  //   playerFile: 'nhl_players.json', scheduleFile: 'nhl_schedule.json',
  //   backToBackRelevant: true, // dense schedule like NBA
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
  //   playerFile: 'nfl_players.json', scheduleFile: 'nfl_schedule.json',
  //   backToBackRelevant: false, // one game/week — bye weeks fall out of the same {date,home,away} schedule shape as zero entries for a team in range
  //   filterPositions: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
  //   slotOrder: [...],
  //   slotEligibility: { FLEX: ['RB', 'WR', 'TE'], ... },
  //   categories: [...],
  //   percentageCategories: [],
  //   ...
  // },
}

export function getSportConfig(sport) {
  return SPORT_CONFIGS[sport] ?? SPORT_CONFIGS.nba
}

// Player pool file for a sport, relative to src/data/. Centralizes the
// sport -> data file mapping that was previously duplicated as an inline
// ternary in each /api/season/*.js advisor.
export function getPlayerFile(sport) {
  return getSportConfig(sport).playerFile ?? 'players.json'
}

// Schedule file for a sport, relative to src/data/, or null if that sport
// has no schedule data configured yet (Start/Sit Advisor unavailable).
export function getScheduleFile(sport) {
  return SPORT_CONFIGS[sport]?.scheduleFile ?? null
}

// Whether the Start/Sit Advisor has schedule data to work with for this
// sport. Used by both the API route (to 400 gracefully) and the UI (to hide
// the panel's action button) so they can't drift out of sync.
export function hasScheduleSupport(sport) {
  return Boolean(getScheduleFile(sport))
}
