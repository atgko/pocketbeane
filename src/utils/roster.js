import { CATEGORIES } from '@/constants/categories'

const GUARD_POSITIONS = new Set(['PG', 'SG'])
const FORWARD_POSITIONS = new Set(['SF', 'PF'])

function buildSlots(config) {
  const slots = []
  const add = (type, count) => {
    for (let i = 0; i < (count ?? 0); i++) slots.push({ type, playerId: null })
  }
  add('PG',   config.pgSlots   ?? 1)
  add('SG',   config.sgSlots   ?? 1)
  add('G',    config.gSlots    ?? 1)
  add('SF',   config.sfSlots   ?? 1)
  add('PF',   config.pfSlots   ?? 1)
  add('F',    config.fSlots    ?? 1)
  add('C',    config.cSlots    ?? 1)
  add('UTIL', config.utilSlots ?? 2)
  add('BN',   config.bnSlots   ?? 4)
  return slots
}

function findBestSlot(slots, player) {
  const positions = player.yahoo_positions

  // Exact position match first
  for (const pos of positions) {
    const idx = slots.findIndex(s => s.type === pos && s.playerId === null)
    if (idx !== -1) return idx
  }

  // Flexible guard slot
  if (positions.some(p => GUARD_POSITIONS.has(p))) {
    const idx = slots.findIndex(s => s.type === 'G' && s.playerId === null)
    if (idx !== -1) return idx
  }

  // Flexible forward slot
  if (positions.some(p => FORWARD_POSITIONS.has(p))) {
    const idx = slots.findIndex(s => s.type === 'F' && s.playerId === null)
    if (idx !== -1) return idx
  }

  // UTIL
  const utilIdx = slots.findIndex(s => s.type === 'UTIL' && s.playerId === null)
  if (utilIdx !== -1) return utilIdx

  // Bench
  return slots.findIndex(s => s.type === 'BN' && s.playerId === null)
}

// Returns slots array [{ type, playerId }] with user picks auto-assigned
export function computeRosterAssignment(config, userPicks, playerMap) {
  const slots = buildSlots(config)
  for (const pick of userPicks) {
    const player = playerMap[pick.playerId]
    if (!player) continue
    const idx = findBestSlot(slots, player)
    if (idx !== -1) slots[idx] = { ...slots[idx], playerId: pick.playerId }
  }
  return slots
}

// Returns per-game totals across user's drafted players
// Counting stats: sum; percentage stats: average
export function computeCategoryTotals(userPicks, playerMap) {
  if (userPicks.length === 0) return null
  const players = userPicks.map(p => playerMap[p.playerId]).filter(Boolean)
  if (players.length === 0) return null

  const result = {}
  for (const cat of CATEGORIES) {
    const vals = players.map(p => p.prior_season?.[cat.id]).filter(v => v != null)
    if (vals.length === 0) { result[cat.id] = null; continue }

    if (cat.id === 'fg_pct' || cat.id === 'ft_pct') {
      result[cat.id] = vals.reduce((a, b) => a + b, 0) / vals.length
    } else {
      result[cat.id] = vals.reduce((a, b) => a + b, 0)
    }
  }
  return result
}

export function buildPlayerMap(players) {
  return Object.fromEntries(players.map(p => [p.id, p]))
}

export function formatStat(catId, value) {
  if (value == null) return '—'
  if (catId === 'fg_pct' || catId === 'ft_pct') {
    return value.toFixed(3).replace(/^0/, '')
  }
  return value.toFixed(1)
}
