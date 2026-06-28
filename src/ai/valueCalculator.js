// ─── Snake ────────────────────────────────────────────────────────────────────

// Ranks available players by fit for the user's team.
// Score = ADP value (how far pick is above/below player's ADP) + category fit (z-score weighted by gap severity).
// philosophy: { strategy, puntCategories, injuryTolerance } — optional, defaults to Beane Mode
export function rankByFit(available, categoryGaps, sportConfig, currentPickNumber, philosophy = {}) {
  if (available.length === 0) return []

  const { strategy = 'beane', puntCategories = [], injuryTolerance = 'moderate' } = philosophy
  const lowerBetterSet = new Set(sportConfig.lowerIsBetter ?? [])

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
      // Lower-is-better categories (TO, ERA, WHIP): invert z so lower values score positively
      categoryFit += lowerBetterSet.has(catId) ? -z * 1.5 : z * 1.5
    }
    for (const catId of strongCatIds) {
      const stat = poolStats[catId]
      const val = player.prior_season?.[catId]
      if (!stat || val == null) continue
      const z = (val - stat.mean) / stat.stdDev
      categoryFit -= lowerBetterSet.has(catId) ? -z * 0.3 : z * 0.3
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

// ─── Auction ──────────────────────────────────────────────────────────────────

// Ranks available players by fit for the user's team in an auction draft.
// Value signal: how a player's auction_value compares to the user's average
// remaining budget per spot. Category fit scoring is identical to snake.
// boardState must include: spendableBudget, avgCostPerRemainingSpot, userPicksRemaining.
export function rankByFitAuction(available, categoryGaps, sportConfig, boardState, philosophy = {}) {
  if (available.length === 0) return []

  const { strategy = 'beane', puntCategories = [], injuryTolerance = 'moderate' } = philosophy
  const { spendableBudget, avgCostPerRemainingSpot } = boardState
  const lowerBetterSet = new Set(sportConfig.lowerIsBetter ?? [])

  const weakCatIds = categoryGaps
    .filter(g => (g.grade === 'weak' || g.grade === 'missing') && !puntCategories.includes(g.id))
    .map(g => g.id)

  const strongCatIds = categoryGaps
    .filter(g => g.grade === 'strong')
    .map(g => g.id)
    .concat(puntCategories)

  const valueWeight  = strategy === 'stars-and-scrubs' ? 1.6 : 1.0
  const catFitWeight = strategy === 'stars-and-scrubs' ? 0.6 : 1.0

  const poolStats = {}
  for (const cat of sportConfig.categories) {
    const vals = available.map(p => p.prior_season?.[cat.id]).filter(v => v != null)
    if (vals.length === 0) continue
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const stdDev = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1
    poolStats[cat.id] = { mean, stdDev }
  }

  const scored = available.map(player => {
    const auctionVal = player.auction_value ?? 1

    // How premium is this player relative to what you can spend per remaining pick?
    // Positive = player is worth more than your avg remaining allocation (prioritize early).
    // Normalised by avgCost so the scale is comparable to the category fit z-scores.
    const avg = avgCostPerRemainingSpot ?? auctionVal
    const valueSignal = avg > 0 ? (auctionVal - avg) / avg : 0

    let categoryFit = 0
    for (const catId of weakCatIds) {
      const stat = poolStats[catId]
      const val = player.prior_season?.[catId]
      if (!stat || val == null) continue
      const z = (val - stat.mean) / stat.stdDev
      categoryFit += lowerBetterSet.has(catId) ? -z * 1.5 : z * 1.5
    }
    for (const catId of strongCatIds) {
      const stat = poolStats[catId]
      const val = player.prior_season?.[catId]
      if (!stat || val == null) continue
      const z = (val - stat.mean) / stat.stdDev
      categoryFit -= lowerBetterSet.has(catId) ? -z * 0.3 : z * 0.3
    }

    let score = (valueSignal * valueWeight) + (categoryFit * catFitWeight)

    // Hard penalty for players the user can't actually afford right now
    if (spendableBudget != null && auctionVal > spendableBudget) score -= 5.0

    if (player.injury_risk) {
      if (injuryTolerance === 'conservative') score -= 2.0
      else if (injuryTolerance === 'aggressive') score += 0.5
    }

    return { player, score, valueSignal, categoryFit }
  })

  return scored.sort((a, b) => b.score - a.score)
}

// Flags high-value targets the user should prioritize in an auction.
// Signals: contract-year motivation, strong fit for weak categories at reasonable cost.
// Returns up to 5 targets with signal labels.
export function computeAuctionTargets(available, categoryGaps, boardState) {
  if (available.length === 0) return []

  const { spendableBudget, avgCostPerRemainingSpot } = boardState
  const weakCatIds = categoryGaps
    .filter(g => g.grade === 'weak' || g.grade === 'missing')
    .map(g => g.id)

  return available
    .map(player => {
      const auctionVal = player.auction_value ?? 1
      const signals = []
      let score = 0

      if (player.contract_year) {
        signals.push('contract year')
        score += 1.5
      }

      // Affordable relative to budget — player fits within remaining allocation
      if (spendableBudget != null && auctionVal <= spendableBudget) {
        const avg = avgCostPerRemainingSpot ?? auctionVal
        if (auctionVal > avg * 1.2) {
          signals.push(`premium target ($${auctionVal})`)
          score += 1.0
        }
      }

      // Strong contributor to a weak category
      const catStrength = weakCatIds.filter(catId => {
        const val = player.prior_season?.[catId]
        return val != null && val > 0
      })
      if (catStrength.length > 0) {
        signals.push(`addresses weak cat${catStrength.length > 1 ? 's' : ''}`)
        score += catStrength.length * 0.8
      }

      return { player, score, signals }
    })
    .filter(t => t.signals.length > 0 && t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
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
