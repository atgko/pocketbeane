// roster.js is sport-agnostic — callers inject sport config from SPORT_CONFIGS.

function buildSlots(config, sportConfig) {
  const slots = []
  for (const slot of sportConfig.slotOrder) {
    const count = config[slot.configKey] ?? slot.default
    for (let i = 0; i < count; i++) slots.push({ type: slot.type, playerId: null })
  }
  return slots
}

function findBestSlot(slots, player, slotEligibility) {
  const positions = new Set(player.yahoo_positions)

  // Exact position match first
  for (const pos of player.yahoo_positions) {
    const idx = slots.findIndex(s => s.type === pos && s.playerId === null)
    if (idx !== -1) return idx
  }

  // Flexible slots in priority order (G before F before UTIL, per slotEligibility key order)
  for (const [flexSlot, eligiblePositions] of Object.entries(slotEligibility)) {
    if (eligiblePositions.some(p => positions.has(p))) {
      const idx = slots.findIndex(s => s.type === flexSlot && s.playerId === null)
      if (idx !== -1) return idx
    }
  }

  // Bench
  return slots.findIndex(s => s.type === 'BN' && s.playerId === null)
}

// Returns slots array [{ type, playerId }] with user picks auto-assigned
export function computeRosterAssignment(config, userPicks, playerMap, sportConfig) {
  const slots = buildSlots(config, sportConfig)
  for (const pick of userPicks) {
    const player = playerMap[pick.playerId]
    if (!player) continue
    const idx = findBestSlot(slots, player, sportConfig.slotEligibility)
    if (idx !== -1) slots[idx] = { ...slots[idx], playerId: pick.playerId }
  }
  return slots
}

// Returns per-game totals across user's drafted players.
// Counting stats: sum; percentage stats (listed in percentageCategories): average.
export function computeCategoryTotals(userPicks, playerMap, categories, percentageCategories) {
  if (userPicks.length === 0) return null
  const players = userPicks.map(p => playerMap[p.playerId]).filter(Boolean)
  if (players.length === 0) return null

  const pctSet = new Set(percentageCategories)
  const result = {}
  for (const cat of categories) {
    const vals = players.map(p => p.prior_season?.[cat.id]).filter(v => v != null)
    if (vals.length === 0) { result[cat.id] = null; continue }
    result[cat.id] = pctSet.has(cat.id)
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : vals.reduce((a, b) => a + b, 0)
  }
  return result
}

export function buildPlayerMap(players) {
  return Object.fromEntries(players.map(p => [p.id, p]))
}

export function formatStat(catId, value, percentageCategories) {
  if (value == null) return '—'
  if (percentageCategories.includes(catId)) {
    return value.toFixed(3).replace(/^0/, '')
  }
  return value.toFixed(1)
}
