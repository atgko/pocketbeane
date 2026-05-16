// Ranks available players by fit for the user's team.
// Score = ADP value (how far pick is above/below player's ADP) + category fit (z-score weighted by gap severity).
export function rankByFit(available, categoryGaps, sportConfig, currentPickNumber) {
  if (available.length === 0) return []

  const weakCatIds = categoryGaps
    .filter(g => g.grade === 'weak' || g.grade === 'missing')
    .map(g => g.id)

  const strongCatIds = categoryGaps
    .filter(g => g.grade === 'strong')
    .map(g => g.id)

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

    return { player, score: adpValue + categoryFit, adpValue, categoryFit }
  })

  return scored.sort((a, b) => b.score - a.score)
}
