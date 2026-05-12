export const CATEGORIES = [
  { id: 'pts',      label: 'PTS', description: 'Points' },
  { id: 'reb',      label: 'REB', description: 'Rebounds' },
  { id: 'ast',      label: 'AST', description: 'Assists' },
  { id: 'stl',      label: 'STL', description: 'Steals' },
  { id: 'blk',      label: 'BLK', description: 'Blocks' },
  { id: 'to',       label: 'TO',  description: 'Turnovers' },
  { id: 'fg_pct',   label: 'FG%', description: 'Field Goal %' },
  { id: 'ft_pct',   label: 'FT%', description: 'Free Throw %' },
  { id: 'three_pm', label: '3PM', description: '3-Pointers Made' },
]

export const DEFAULT_CATEGORIES = CATEGORIES.map(c => c.id)

export const CATEGORY_BENCHMARKS = {
  pts:      20.0,
  reb:       7.5,
  ast:       5.0,
  stl:       1.2,
  blk:       0.8,
  to:        2.8,
  fg_pct:    0.470,
  ft_pct:    0.780,
  three_pm:  1.8,
}
