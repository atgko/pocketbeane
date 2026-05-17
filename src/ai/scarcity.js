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
