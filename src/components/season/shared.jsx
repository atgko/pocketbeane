import { useMemo } from 'react'
import { normalizeName } from '@/utils/playerName'
import { STALENESS_DAYS } from '@/ai/seasonStats'
import { getSportConfig } from '@/config/sports'
import {
  getStandingTier,
  getTrend,
  aggregateCategoryTotals,
  getCategoryWinRates,
  getOverallWinRate,
} from '@/utils/teamStanding'

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export const TREND_STYLES = {
  improving: { icon: '↑', color: 'text-signal-up' },
  'slightly-improving': { icon: '↗', color: 'text-signal-up/70' },
  stable:    { icon: '→', color: 'text-ink-secondary' },
  'slightly-declining': { icon: '↘', color: 'text-signal-down/70' },
  declining: { icon: '↓', color: 'text-signal-down' },
}

// Condensed Start/Sit rendering (NBA/NHL) shows injury status as its own
// short tag rather than folding it into prose — see startSitMode in sports.js.
export const INJURY_LABELS = {
  'day-to-day': 'DTD',
  il: 'IL',
  out: 'OUT',
  ir: 'IR',
}

// Mirrors Badge's up/info/neutral tones, but kept as raw classes: these are
// 10px micro-tags in dense rows, and Badge's fixed text-label sizing wins over
// a className override, so using <Badge> here would visibly grow them.
export const PITCHING_REC_STYLES = {
  start: 'bg-signal-up/15 text-signal-up',
  stream: 'bg-signal-info/15 text-signal-info',
  hold: 'bg-surface-overlay text-ink-secondary',
}

export const PRIORITY_STYLES = {
  'must-add': 'bg-signal-up/15 text-signal-up',
  'consider': 'bg-signal-info/15 text-signal-info',
  'speculative': 'bg-surface-overlay text-ink-secondary',
}

export const TIER_STYLES = {
  contender:  { label: 'Contender',      color: 'text-signal-up',    bg: 'bg-signal-up/10 border-signal-up/20' },
  bubble:     { label: 'Playoff Bubble', color: 'text-signal-watch', bg: 'bg-signal-watch/10 border-signal-watch/20' },
  rebuilding: { label: 'Rebuilding',     color: 'text-signal-down',  bg: 'bg-signal-down/10 border-signal-down/20' },
}

export const STANDING_TREND_ARROW = {
  up:   { icon: '↑', color: 'text-signal-up' },
  down: { icon: '↓', color: 'text-signal-down' },
  flat: { icon: '→', color: 'text-ink-secondary' },
}

export const WIN_RATE_GRADE_STYLES = {
  strong: 'text-signal-up bg-signal-up/10 border-signal-up/20',
  ok:     'text-signal-watch bg-signal-watch/10 border-signal-watch/20',
  weak:   'text-signal-down bg-signal-down/10 border-signal-down/20',
}

export const WIN_RATE_BAR_COLOR = {
  strong: 'bg-signal-up/60',
  ok:     'bg-signal-watch/50',
  weak:   'bg-signal-down/60',
}

export const TROPHY_BY_RANK = { 1: '🥇', 2: '🥈', 3: '🥉' }

export const SLOT_CONFIG_KEYS = [
  'pgSlots', 'sgSlots', 'gSlots', 'sfSlots', 'pfSlots', 'fSlots', 'cSlots', 'utilSlots', 'bnSlots',
  'firstSlots', 'secondSlots', 'thirdSlots', 'ssSlots', 'ofSlots', 'spSlots', 'rpSlots',
]

export function findPlayerByName(players, name) {
  if (!name) return null
  const target = normalizeName(name)
  return players.find(p => normalizeName(p.name) === target) ?? null
}

export function isCurrentSeasonStale(asOfDate) {
  if (!asOfDate) return false
  const ageDays = (Date.now() - new Date(asOfDate).getTime()) / (1000 * 60 * 60 * 24)
  return ageDays >= STALENESS_DAYS
}

export function isSyncStale(syncedAt) {
  if (!syncedAt) return true
  return Date.now() - new Date(syncedAt).getTime() > SEVEN_DAYS_MS
}

export function formatSyncedAt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Trend indicator for current-season data — renders nothing when current_season
// doesn't exist for a player (no badge = no in-season snapshot yet, rather than
// labeling every player without one).
export function TrendBadge({ player }) {
  const cs = player?.current_season
  if (!cs) return null
  const style = TREND_STYLES[cs.trend] ?? TREND_STYLES.stable
  const stale = isCurrentSeasonStale(cs.as_of_date)
  const dateLabel = new Date(cs.as_of_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return (
    <span
      className={`ml-1 text-[10px] font-mono tabular-nums whitespace-nowrap ${stale ? 'text-ink-muted' : style.color}`}
      title={`Current season stats as of ${cs.as_of_date} (${cs.gp} GP)${stale ? ' — stale, treat as prior-season-only' : ''}`}
    >
      {style.icon} {stale ? `stale·${dateLabel}` : dateLabel}
    </span>
  )
}

// Turns the -100..100 favorScore into a plain-language statement, naming
// whichever side (the user or the trade partner) the score favors.
export function favorStatement(score, partnerTeamName) {
  const magnitude = Math.abs(score)
  const who = score >= 0 ? 'You' : partnerTeamName
  if (magnitude <= 10) return 'This is a roughly even trade'
  if (magnitude <= 35) return `This trade slightly favors ${who}`
  if (magnitude <= 65) return `This trade favors ${who}`
  return `This trade strongly favors ${who}`
}

// Track background: green at dead-even, through yellow, to red at either
// extreme — color reflects how lopsided the trade is, not which side it
// favors, since favoring either team equally hard should read the same way.
export const FAVOR_TRACK_GRADIENT =
  'linear-gradient(to right, rgb(var(--color-signal-down)) 0%, rgb(var(--color-signal-watch)) 25%, rgb(var(--color-signal-up)) 50%, rgb(var(--color-signal-watch)) 75%, rgb(var(--color-signal-down)) 100%)'

// A full-width scale with a single arrow marker landing at the point
// corresponding to how lopsided the trade is — works the same whether the
// user proposed the trade or is evaluating one they were offered, since
// nothing is "filled in" toward either side as the implied right answer.
export function TradeFavorBar({ favorScore, partnerTeamName }) {
  const score = Math.max(-100, Math.min(100, favorScore ?? 0))
  const markerPct = (100 - score) / 2 // 0 = fully favors you (left), 100 = fully favors partner (right)

  return (
    <div>
      <p className="text-sm text-ink-primary font-medium mb-3">{favorStatement(score, partnerTeamName)}</p>
      <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1.5">
        <span>You</span>
        <span>{partnerTeamName}</span>
      </div>
      <div className="relative w-full h-1.5">
        <div className="absolute inset-0 rounded-full" style={{ background: FAVOR_TRACK_GRADIENT }} />
        {/* 50/50 tick — a fixed reference point, independent of favorScore */}
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-px h-2.5 bg-ink-primary/70" />
        <div
          className="absolute -translate-x-1/2 text-ink-primary"
          style={{
            left: `${markerPct}%`,
            top: '100%',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderBottom: '6px solid currentColor',
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
          }}
        />
      </div>
      <p className="text-center text-[9px] font-mono tabular-nums text-ink-muted mt-2.5">50 / 50</p>
    </div>
  )
}

// Toggleable player button shared by both sides of the Trade Analyzer's
// roster pickers — selected players get the same pick-accent treatment used
// for primary actions elsewhere in this file.
export function TradePlayerToggle({ player, selected, onToggle }) {
  const hurt = player.status && player.status !== 'active'
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left text-xs px-2.5 py-1.5 rounded border transition-colors ${
        selected
          ? 'bg-beane-green/10 border-beane-green/40 text-beane-green-text'
          : 'bg-surface-base border-surface-line text-ink-secondary hover:border-ink-muted'
      }`}
    >
      {player.name}
      {player.positions && <span className="ml-1.5 font-mono text-[10px] text-ink-muted">{player.positions}</span>}
      {hurt && <span className="ml-1.5 font-mono text-[10px] text-signal-watch/80">{player.status}</span>}
    </button>
  )
}

// Deterministic stand-in for the per-team Claude insight when the user's
// team wasn't specifically called out in the league-pulse response (that
// endpoint only covers teams that are "genuinely dominating" or "clearly
// rebuilding" — a solid mid-pack team may not appear in either list).
// Always available, since it's built entirely from the win-rate data above.
export function buildFallbackInsight(entry, sportConfig) {
  const tierLabel = TIER_STYLES[entry.tier]?.label ?? 'standing unclear'
  const ranked = sportConfig.categories
    .map(c => ({ label: c.label, rate: entry.winRates[c.id]?.rate }))
    .filter(c => c.rate != null)
    .sort((a, b) => b.rate - a.rate)
  if (ranked.length === 0) return `Sitting at #${entry.team.rank ?? '?'} (${tierLabel}).`
  const strongest = ranked[0]
  const weakest = ranked[ranked.length - 1]
  return `Sitting at #${entry.team.rank ?? '?'} (${tierLabel}) — strongest in ${strongest.label}, thinnest in ${weakest.label}.`
}

// Shared standing computation — Contender/Bubble/Rebuilding tier, trend
// arrow, and per-category win rates for every team, resolved once and
// consumed by both the League tab (full landscape) and the My Team tab
// (just the user's own category bars). Pure client-side math over data
// already on the page — no fetch involved.
export function useTeamStanding({ league, rosters, players }) {
  const sport = league.config.sport ?? 'nba'
  const sportConfig = getSportConfig(sport)

  const standing = useMemo(() => {
    const playerById = Object.fromEntries(players.map(p => [p.id, p]))
    const resolveRoster = (roster) => roster
      .map(r => (r.playerId && playerById[r.playerId]) || findPlayerByName(players, r.name))
      .filter(Boolean)

    const allTeamTotals = {}
    for (const team of rosters.teams) {
      allTeamTotals[team.teamKey] = aggregateCategoryTotals(
        resolveRoster(team.roster), sportConfig.categories, sportConfig.percentageCategories
      )
    }

    const numTeams = rosters.teams.length
    const teams = [...rosters.teams]
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      .map(team => {
        const winRates = getCategoryWinRates({
          teamKey: team.teamKey,
          allTeamTotals,
          categories: sportConfig.categories,
          lowerIsBetter: sportConfig.lowerIsBetter,
        })
        return { team, tier: getStandingTier({ rank: team.rank, numTeams }), overallWinRate: getOverallWinRate(winRates), winRates }
      })

    const userEntry = teams.find(t => t.team.isUser) ?? null
    const previousRank = userEntry ? league.previousStandings?.[userEntry.team.teamKey]?.rank ?? null : null
    const trend = userEntry ? getTrend({ currentRank: userEntry.team.rank, previousRank }) : null

    return { teams, userEntry, trend }
  }, [rosters, sportConfig, players, league.previousStandings])

  return { ...standing, sportConfig, sport }
}
