// Pure computation — callers inject allPlayers so this stays testable and import-free.
export function computeBoardState(league, allPlayers) {
  const { config, draft, rosterSlots } = league
  const picks = draft.picks
  const draftedIds = new Set(picks.map(p => p.playerId))
  const available = allPlayers.filter(p => !draftedIds.has(p.id))
  const userPicks = picks.filter(p => p.draftedBy === 'user')
  const numTeams = config.numTeams
  const totalRosterSlots = rosterSlots.length
  const userPicksRemaining = totalRosterSlots - userPicks.length

  // Auction budget tracking — null for snake drafts
  const isAuction = config.draftType === 'auction'
  const budgetSpent = isAuction
    ? userPicks.reduce((sum, p) => sum + (p.price ?? 0), 0)
    : null
  const budgetRemaining = isAuction ? config.auctionBudget - budgetSpent : null
  // Must keep $1 per remaining spot as a floor bid
  const spendableBudget = isAuction && userPicksRemaining > 0
    ? budgetRemaining - (userPicksRemaining - 1)
    : null
  const avgCostPerRemainingSpot = isAuction && userPicksRemaining > 0
    ? budgetRemaining / userPicksRemaining
    : null

  return {
    available,
    userPicks,
    draftedIds,
    totalPicks: picks.length,
    currentPick: picks.length + 1,
    currentRound: Math.ceil((picks.length + 1) / numTeams),
    totalRosterSlots,
    userPicksRemaining,
    numTeams,
    draftPosition: config.draftPosition,
    // Auction fields (null for snake)
    budgetSpent,
    budgetRemaining,
    spendableBudget,
    avgCostPerRemainingSpot,
  }
}
