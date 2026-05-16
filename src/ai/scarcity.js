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
