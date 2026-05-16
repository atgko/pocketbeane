// Pure computation — callers inject allPlayers so this stays testable and import-free.
export function computeBoardState(league, allPlayers) {
  const { config, draft, rosterSlots } = league
  const picks = draft.picks
  const draftedIds = new Set(picks.map(p => p.playerId))
  const available = allPlayers.filter(p => !draftedIds.has(p.id))
  const userPicks = picks.filter(p => p.draftedBy === 'user')
  const numTeams = config.numTeams
  const totalRosterSlots = rosterSlots.length

  return {
    available,
    userPicks,
    draftedIds,
    totalPicks: picks.length,
    currentPick: picks.length + 1,
    currentRound: Math.ceil((picks.length + 1) / numTeams),
    totalRosterSlots,
    userPicksRemaining: totalRosterSlots - userPicks.length,
    numTeams,
    draftPosition: config.draftPosition,
  }
}
