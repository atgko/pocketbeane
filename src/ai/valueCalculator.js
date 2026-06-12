// Ranks available players by fit for the user's team.
// Score = ADP value (how far pick is above/below player's ADP) + category fit (z-score weighted by gap severity).
// philosophy: { strategy, puntCategories, injuryTolerance } — optional, defaults to Beane Mode
export function rankByFit(available, categoryGaps, sportConfig, currentPickNumber, philosophy = {}) {
  if (available.length === 0) return []

  const { strategy = 'beane', puntCategories = [], injuryTolerance = 'moderate' } = philosophy

  // Punted categories are treated as already covered — don't try to fill them
  const weakCatIds = categoryGaps
    .filter(g => (g.grade === 'weak' || g.grade === 'missing') && !puntCategories.includes(g.id))
    .map(g => g.id)

  const strongCatIds = categoryGaps
    .filter(g => g.grade === 'strong')
    .map(g => g.id)
    .concat(puntCategories)

  // Stars & Scrubs: ADP value dominates, category fit plays a smaller role
  const adpWeight    = strategy === 'stars-and-scrubs' ? 1.6 : 1.0
  const catFitWeight = strategy === 'stars-and-scrubs' ? 0.6 : 1.0

  // Pool mean + stddev for z-score normalization
  const poolStats = {}
  for (const cat of sportConfig.categories) {
    const vals = available.map(p => p.prior_season?.[cat.id]).filter(v => v != null)
    if (vals.length === 0) continue
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const stdDev = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1
    poolStats[cat.id] = { mean, stdDev }
  }

  const scored = available.map(player => {
    // Positive = player is available later than their ADP implies (good value)
    const adpValue = (currentPickNumber - player.adp) / 15

    let categoryFit = 0
    for (const catId of weakCatIds) {
      const stat = poolStats[catId]
      const val = player.prior_season?.[catId]
      if (!stat || val == null) continue
      const z = (val - stat.mean) / stat.stdDev
      // For TOs, lower is better — invert z so "fewer TOs" scores positively
      categoryFit += catId === 'to' ? -z * 1.5 : z * 1.5
    }
    for (const catId of strongCatIds) {
      const stat = poolStats[catId]
      const val = player.prior_season?.[catId]
      if (!stat || val == null) continue
      const z = (val - stat.mean) / stat.stdDev
      categoryFit -= catId === 'to' ? -z * 0.3 : z * 0.3
    }

    let score = (adpValue * adpWeight) + (categoryFit * catFitWeight)

    // Injury tolerance: conservative docks risk players, aggressive exploits market discount
    if (player.injury_risk) {
      if (injuryTolerance === 'conservative') score -= 2.0
      else if (injuryTolerance === 'aggressive') score += 0.5
    }

    return { player, score, adpValue, categoryFit }
  })

  return scored.sort((a, b) => b.score - a.score)
}

// Flags undervalued players still on the board relative to their ADP or contract-year motivation.
// Returns up to 5 sleepers with signal labels.
export function computeSleepers(available, currentPickNumber) {
  if (available.length === 0) return []

  return available
    .map(player => {
      const adpGap = currentPickNumber - player.adp  // positive = falling past their expected ADP
      const signals = []
      let score = 0

      if (adpGap > 10) {
        signals.push(`ADP ${player.adp.toFixed(1)} — fell ${Math.round(adpGap)} picks`)
        score += adpGap / 10
      }

      if (player.contract_year) {
        signals.push('contract year')
        score += 1.5
      }

      return { player, score, signals }
    })
    .filter(s => s.signals.length > 0 && s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}
