// Returns true if pick #pickNum (1-indexed) belongs to the user at draftPosition in a numTeams snake draft.
// Odd rounds: positions 1→N (ascending). Even rounds: positions N→1 (descending).
export function isUserTurn(pickNum, draftPosition, numTeams) {
  const round = Math.ceil(pickNum / numTeams)
  const pickInRound = pickNum - (round - 1) * numTeams
  const position = round % 2 === 1
    ? pickInRound
    : numTeams - pickInRound + 1
  return position === draftPosition
}

// Returns the pick number of the user's next turn after currentPickNum.
// Scans at most 2 full rounds forward to handle the snake turn-around.
export function getNextUserPickNum(currentPickNum, draftPosition, numTeams) {
  for (let pick = currentPickNum + 1; pick <= currentPickNum + 2 * numTeams; pick++) {
    if (isUserTurn(pick, draftPosition, numTeams)) return pick
  }
  return null
}
