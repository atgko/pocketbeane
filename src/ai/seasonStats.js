// Shared prior/current season stat formatting for AI prompts (waiver wire,
// matchup advisor, trade analyzer). Keeps the compact `key=value` line format
// consistent across advisors and centralizes the T2-1 staleness/trend logic.

// The weekly digest fires every Monday, so data older than a week means a
// refresh cycle was missed — flag it right as that digest goes out rather
// than waiting for a second missed cycle to notice.
export const STALENESS_DAYS = 7

export const CURRENT_SEASON_REASONING_INSTRUCTION = `When current_season data is available, reason explicitly about any gap between prior_season and current_season performance. Consider: buy-low opportunity (underperforming, likely to regress upward), genuine decline (role change/age/injury, likely to continue), or sell-high opportunity (overperformance unlikely to sustain). If current_season is unavailable or marked STALE, note that the assessment is based on prior season data only.`

export const IL_STASH_REASONING_INSTRUCTION = `A player tagged [STASHED ON IL/IL+] is parked in a dedicated injured-list slot, not occupying an active roster spot — the league has room for him separately from the active roster, so being hurt is not by itself a reason to drop him. Judge him purely on real trade/keep value (draft capital, prior production, and how believable the return timeline is) the same as any other player. Only recommend dropping an IL-stashed player when that value itself has genuinely collapsed. A player with no [STASHED ON ...] tag who is hurt IS occupying a real, competed-for roster spot, so factor that roster-space cost into add/drop reasoning normally.`

function fmt(val, isPct) {
  if (val == null) return '—'
  return isPct ? val.toFixed(3) : val.toFixed(1)
}

function formatSeasonStats(stats, player, sport) {
  if (sport === 'mlb') {
    const isPitcher = player.yahoo_positions?.some(p => ['SP', 'RP', 'P'].includes(p))
    if (isPitcher) return `w=${fmt(stats.w, false)} sv=${fmt(stats.sv, false)} k=${fmt(stats.k, false)} era=${fmt(stats.era, false)} whip=${fmt(stats.whip, false)}`
    return `r=${fmt(stats.r, false)} hr=${fmt(stats.hr, false)} rbi=${fmt(stats.rbi, false)} sb=${fmt(stats.sb, false)} avg=${fmt(stats.avg, true)}`
  }
  return `pts=${fmt(stats.pts, false)} reb=${fmt(stats.reb, false)} ast=${fmt(stats.ast, false)} stl=${fmt(stats.stl, false)} blk=${fmt(stats.blk, false)} 3pm=${fmt(stats.three_pm, false)} fg%=${fmt(stats.fg_pct, true)} ft%=${fmt(stats.ft_pct, true)}`
}

export function formatStats(player, sport) {
  const s = player?.prior_season
  if (!s) return 'rookie/no stats'
  return formatSeasonStats(s, player, sport)
}

function isStale(asOfDate) {
  if (!asOfDate) return false
  const ageDays = (Date.now() - new Date(asOfDate).getTime()) / (1000 * 60 * 60 * 24)
  return ageDays >= STALENESS_DAYS
}

// Returns a compact suffix describing current-season performance vs. the
// prior-season baseline, or '' when no current_season snapshot exists —
// callers append this directly after formatStats() output.
export function formatCurrentSeasonLine(player, sport) {
  const cs = player?.current_season
  if (!cs) return ''
  const stats = formatSeasonStats(cs, player, sport)
  const staleTag = isStale(cs.as_of_date) ? ', STALE' : ''
  const injuryTag = cs.injury_status && cs.injury_status !== 'healthy'
    ? ` [${cs.injury_status.toUpperCase()}${cs.injury_note ? `: ${cs.injury_note}` : ''}]`
    : ''
  return ` || CURRENT (as of ${cs.as_of_date}, ${cs.g} GP, ${cs.trend}${staleTag}): ${stats}${injuryTag}`
}

// Yahoo roster slots that mean "stashed, not competing for an active spot."
const IL_SLOT_POSITIONS = new Set(['IL', 'IL+', 'IL10', 'IL15', 'IL60', 'NA'])

// Shared roster-line formatter used by every season advisor prompt (waiver,
// matchup, trade, trade-value-index, league-pulse). `entry` is a roster
// record from sync-rosters.js (has name/positions/selectedPosition); `player`
// is the matching players.json record (stats/ADP/injury_risk), or null if
// unmatched.
export function formatRosterLine(entry, player, sport) {
  const injuryTag = player?.injury_risk ? ' ⚠️' : ''
  const adpTag = player?.adp != null ? `,ADP${player.adp.toFixed(1)}` : ''
  const stashTag = entry?.selectedPosition && IL_SLOT_POSITIONS.has(entry.selectedPosition)
    ? ` [STASHED ON ${entry.selectedPosition}]`
    : ''
  const statsLine = player ? formatStats(player, sport) : 'no stats'
  const currentLine = player ? formatCurrentSeasonLine(player, sport) : ''
  return `${entry.name}(${entry.positions ?? '?'}${adpTag}${injuryTag}${stashTag}): ${statsLine}${currentLine}`
}

// Compact league roster-settings line (IL slot availability) to give the
// model context on whether an injured player is using a scarce active spot
// or a dedicated stash slot. Returns '' when rosterConfig wasn't provided.
export function formatRosterConfigLine(rosterConfig) {
  if (!rosterConfig) return ''
  const { ilSlots, ilPlusSlots } = rosterConfig
  const parts = []
  if (ilSlots) parts.push(`${ilSlots} IL slot${ilSlots === 1 ? '' : 's'}`)
  if (ilPlusSlots) parts.push(`${ilPlusSlots} IL+ slot${ilPlusSlots === 1 ? '' : 's'}`)
  if (!parts.length) return '\nLeague roster settings: no IL slots — an injured player occupies a normal active/bench spot.'
  return `\nLeague roster settings: ${parts.join(', ')} available for stashing injured players separately from the active roster.`
}
