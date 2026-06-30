// Shared prior/current season stat formatting for AI prompts (waiver wire,
// matchup advisor, trade analyzer). Keeps the compact `key=value` line format
// consistent across advisors and centralizes the T2-1 staleness/trend logic.

export const STALENESS_DAYS = 14

export const CURRENT_SEASON_REASONING_INSTRUCTION = `When current_season data is available, reason explicitly about any gap between prior_season and current_season performance. Consider: buy-low opportunity (underperforming, likely to regress upward), genuine decline (role change/age/injury, likely to continue), or sell-high opportunity (overperformance unlikely to sustain). If current_season is unavailable or marked STALE, note that the assessment is based on prior season data only.`

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
  return ` || CURRENT (as of ${cs.as_of_date}, ${cs.gp} GP, ${cs.trend}${staleTag}): ${stats}`
}
