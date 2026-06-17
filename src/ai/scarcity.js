// "Elite" = top-20 ADP players (allPlayers must be sorted by ADP ascending)
const ELITE_THRESHOLD = 20

export function computeScarcity(allPlayers, draftedIds, sportConfig) {
  const scarcity = {}

  for (const pos of sportConfig.filterPositions) {
    const byPos = allPlayers.filter(p => p.yahoo_positions.includes(pos))
    const available = byPos.filter(p => !draftedIds.has(p.id))
    const elite = allPlayers.slice(0, ELITE_THRESHOLD).filter(p => p.yahoo_positions.includes(pos))
    const eliteAvailable = elite.filter(p => !draftedIds.has(p.id))

    scarcity[pos] = {
      total: byPos.length,
      available: available.length,
      eliteTotal: elite.length,
      eliteAvailable: eliteAvailable.length,
    }
  }

  return scarcity
}

export function getScarcityAlerts(scarcity) {
  return Object.entries(scarcity)
    .filter(([, s]) => s.eliteTotal > 0 && s.eliteAvailable <= 2)
    .map(([pos, s]) => {
      if (s.eliteAvailable === 0) {
        return `Elite ${pos} pool is gone — ${s.available} ${pos}s remain overall.`
      }
      return `Only ${s.eliteAvailable} elite ${pos} left — consider drafting soon.`
    })
}

// Primary positions for depth analysis — flex slots (G, F) are derived from these.
const PRIMARY_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']
// Slot types that don't count as starters (excluded from quality threshold + demand).
const BENCH_SLOT_TYPES = new Set(['BN', 'IL', 'IL+'])
// Severity ratio thresholds: laterCount / remainingDemand.
const DEPTH_THRESHOLDS = { EMPTY: 0.15, COLLAPSE: 0.35, THIN: 0.6 }

// Computes how many quality options survive at each position after picksUntilNext opponent picks.
// Quality and severity are derived from league config and draft progress — no hardcoded magic numbers.
// available must be sorted by ADP ascending (players.json order is preserved through computeBoardState).
export function computePositionalDepth(available, picksUntilNext, numTeams, totalPicks, totalRosterSlots, leagueConfig, sportConfig) {
  // Quality threshold: players that will fill starting slots across the entire league.
  // Prefer Yahoo roster data (has exact counts + isStarter flag); fall back to manual config.
  const starterSlots = leagueConfig.yahooRosterPositions
    ? leagueConfig.yahooRosterPositions
        .filter(r => r.isStarter)
        .reduce((sum, r) => sum + r.count, 0)
    : sportConfig.slotOrder
        .filter(slot => !BENCH_SLOT_TYPES.has(slot.type))
        .reduce((sum, slot) => sum + (leagueConfig[slot.configKey] ?? slot.default), 0)

  const qualityThreshold = numTeams * starterSlots

  // Draft progress drives remaining demand — as the draft advances, fewer total slots remain.
  const totalDraftPicks = numTeams * totalRosterSlots
  const draftProgress = totalDraftPicks > 0 ? totalPicks / totalDraftPicks : 0

  // Resolves how many slots of a given type exist per team (Yahoo data preferred, then config).
  function slotCountByType(slotType) {
    if (leagueConfig.yahooRosterPositions) {
      return leagueConfig.yahooRosterPositions.find(r => r.position === slotType)?.count ?? 0
    }
    const slot = sportConfig.slotOrder.find(s => s.type === slotType)
    return slot ? (leagueConfig[slot.configKey] ?? slot.default) : 0
  }

  const projected = available.slice(picksUntilNext)

  return PRIMARY_POSITIONS.map(pos => {
    // Per-position demand: direct slot + any flex slot this position qualifies for.
    let slotsPerTeam = slotCountByType(pos)
    for (const [flexSlot, eligiblePositions] of Object.entries(sportConfig.slotEligibility)) {
      if (eligiblePositions.includes(pos)) slotsPerTeam += slotCountByType(flexSlot)
    }
    const totalDemand = numTeams * slotsPerTeam
    // Remaining demand scales with how much of the draft is left; floor at 1 to avoid division by zero.
    const remainingDemand = Math.max(1, Math.round(totalDemand * (1 - draftProgress)))

    const nowCount = available.filter(p => p.yahoo_positions.includes(pos) && p.adp <= qualityThreshold).length
    const laterCount = projected.filter(p => p.yahoo_positions.includes(pos) && p.adp <= qualityThreshold).length

    const ratio = laterCount / remainingDemand
    const severity = ratio < DEPTH_THRESHOLDS.EMPTY ? 'EMPTY'
      : ratio < DEPTH_THRESHOLDS.COLLAPSE ? 'COLLAPSE'
      : ratio < DEPTH_THRESHOLDS.THIN ? 'THIN'
      : 'STABLE'

    return { pos, nowCount, laterCount, severity }
  })
}

const ELITE_ADP_THRESHOLD = 35
const GUARD_POSITIONS = ['PG', 'SG']
const FRONT_COURT_POSITIONS = ['SF', 'PF', 'C']

// Scarcity alerts that account for the user's existing team composition.
// Suppresses alerts for positions the user is already covered at, and surfaces
// positional imbalances (e.g. elite guards but no front-court picks yet).
export function getSmartScarcityAlerts(scarcity, userPicks, playerMap) {
  const coveredPositions = new Set()
  let guardCount = 0
  let frontCourtCount = 0
  let hasEliteGuard = false

  for (const pick of userPicks) {
    const player = playerMap[pick.playerId]
    if (!player) continue
    const isElite = player.adp <= ELITE_ADP_THRESHOLD
    for (const pos of player.yahoo_positions) {
      if (isElite) coveredPositions.add(pos)
      if (GUARD_POSITIONS.includes(pos)) {
        guardCount++
        if (isElite) hasEliteGuard = true
      }
      if (FRONT_COURT_POSITIONS.includes(pos)) frontCourtCount++
    }
  }

  const alerts = Object.entries(scarcity)
    .filter(([pos, s]) => {
      if (s.eliteTotal === 0 || s.eliteAvailable > 2) return false
      return !coveredPositions.has(pos)
    })
    .map(([pos, s]) => {
      if (s.eliteAvailable === 0) {
        return `Elite ${pos} pool is gone — ${s.available} ${pos}s remain overall.`
      }
      return `Only ${s.eliteAvailable} elite ${pos} left — don't wait too long.`
    })

  if (hasEliteGuard && guardCount >= 2 && frontCourtCount === 0 && userPicks.length >= 2) {
    alerts.push('Guards are set — the front court pool is thinning, address it before it dries up.')
  }

  return alerts
}
