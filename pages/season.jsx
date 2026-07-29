import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef, useMemo } from 'react'
import useLeagueStore from '@/store/leagueStore'
import { useYahooAuth } from '@/hooks/useYahooAuth'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import { normalizeName } from '@/utils/playerName'
import { STALENESS_DAYS } from '@/ai/seasonStats'
import { hasScheduleSupport, getStartSitMode, getSportConfig } from '@/config/sports'
import {
  getStandingTier,
  getTrend,
  aggregateCategoryTotals,
  getCategoryWinRates,
  getOverallWinRate,
  getWinRateGrade,
} from '@/utils/teamStanding'
import { Card } from '@/components/ui'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

const TREND_STYLES = {
  improving: { icon: '↑', color: 'text-signal-up' },
  'slightly-improving': { icon: '↗', color: 'text-signal-up/70' },
  stable:    { icon: '→', color: 'text-ink-secondary' },
  'slightly-declining': { icon: '↘', color: 'text-signal-down/70' },
  declining: { icon: '↓', color: 'text-signal-down' },
}

// Condensed Start/Sit rendering (NBA/NHL) shows injury status as its own
// short tag rather than folding it into prose — see startSitMode in sports.js.
const INJURY_LABELS = {
  'day-to-day': 'DTD',
  il: 'IL',
  out: 'OUT',
  ir: 'IR',
}

// Mirrors Badge's up/info/neutral tones, but kept as raw classes: these are
// 10px micro-tags in dense rows, and Badge's fixed text-label sizing wins over
// a className override, so using <Badge> here would visibly grow them.
const PITCHING_REC_STYLES = {
  start: 'bg-signal-up/15 text-signal-up',
  stream: 'bg-signal-info/15 text-signal-info',
  hold: 'bg-surface-overlay text-ink-secondary',
}

function findPlayerByName(players, name) {
  if (!name) return null
  const target = normalizeName(name)
  return players.find(p => normalizeName(p.name) === target) ?? null
}

function isCurrentSeasonStale(asOfDate) {
  if (!asOfDate) return false
  const ageDays = (Date.now() - new Date(asOfDate).getTime()) / (1000 * 60 * 60 * 24)
  return ageDays >= STALENESS_DAYS
}

// Trend indicator for current-season data — renders nothing when current_season
// doesn't exist for a player (no badge = no in-season snapshot yet, rather than
// labeling every player without one).
function TrendBadge({ player }) {
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

// Roster Health Score's 1-10 number was never built past this placeholder —
// it's now the Contender/Bubble/Rebuilding tier inside Team Pulse instead.
const COMING_SOON = []

const PRIORITY_STYLES = {
  'must-add': 'bg-signal-up/15 text-signal-up',
  'consider': 'bg-signal-info/15 text-signal-info',
  'speculative': 'bg-surface-overlay text-ink-secondary',
}

function isSyncStale(syncedAt) {
  if (!syncedAt) return true
  return Date.now() - new Date(syncedAt).getTime() > SEVEN_DAYS_MS
}

function formatSyncedAt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function WaiverPanel({ league, rosters }) {
  const [advice, setAdvice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const sport = league.config.sport ?? 'nba'
  const players = sport === 'mlb' ? mlbPlayers : nbaPlayers

  const gmProfile = {
    injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
    draftStrategy: league.config.philosophy?.strategy ?? 'beane',
  }
  const rosterConfig = { ilSlots: league.config.ilSlots, ilPlusSlots: league.config.ilPlusSlots }

  async function handleGetAdvice() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/season/waiver-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, leagueRosters: rosters, gmProfile, rosterConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Advice failed')
      setAdvice(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Waiver Wire Advisor</p>
          <p className="text-xs text-ink-secondary mt-0.5">
            Recommended adds and drops based on your roster gaps and available free agents.
          </p>
        </div>
        <button
          onClick={handleGetAdvice}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {advice ? 'Refresh' : "Get Beane's Take"}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Analyzing your roster…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-signal-down font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-3">
          {advice.headline && (
            <p className="text-xs text-ink-secondary italic leading-relaxed">{advice.headline}</p>
          )}
          {advice.moves?.map((move, i) => {
            const addPlayer = findPlayerByName(players, move.add)
            const dropPlayer = move.drop ? findPlayerByName(players, move.drop) : null
            return (
              <div key={i} className="border border-surface-line rounded-md px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${PRIORITY_STYLES[move.priority] ?? 'bg-surface-overlay text-ink-secondary'}`}>
                    {move.priority ?? 'add'}
                  </span>
                  <span className="text-xs text-signal-up font-medium flex items-center">
                    + {move.add}
                    <TrendBadge player={addPlayer} />
                  </span>
                  {move.drop && (
                    <>
                      <span className="text-ink-muted text-xs">·</span>
                      <span className="text-xs text-signal-down flex items-center">
                        − {move.drop}
                        <TrendBadge player={dropPlayer} />
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">{move.reason}</p>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function MatchupPanel({ league, rosters, yahooConnected }) {
  const [advice, setAdvice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGetAdvice() {
    setLoading(true)
    setError(null)
    try {
      const sport = league.config.sport ?? 'nba'
      const res = await fetch('/api/season/matchup-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueKey: league.config.yahooLeagueKey,
          sport,
          leagueRosters: rosters,
          gmProfile: {
            injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
          },
          rosterConfig: { ilSlots: league.config.ilSlots, ilPlusSlots: league.config.ilPlusSlots },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Advice failed')
      setAdvice(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canRun = yahooConnected && Boolean(league.config.yahooLeagueKey)

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Head-to-Head Matchup Advisor</p>
          <p className="text-xs text-ink-secondary mt-0.5">
            Weekly category projections vs. your current opponent with lineup suggestions.
          </p>
        </div>
        {canRun ? (
          <button
            onClick={handleGetAdvice}
            disabled={loading}
            className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {advice ? 'Refresh' : "Get Beane's Take"}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-signal-watch/60 font-mono">Needs Yahoo</span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Pulling this week's matchup…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-signal-down font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-ink-secondary font-mono tabular-nums">
            Week {advice.week} vs. {advice.opponent}
          </p>
          {advice.outlook && (
            <p className="text-xs text-ink-secondary leading-relaxed italic">{advice.outlook}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {advice.winCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-signal-up uppercase tracking-wider mb-1.5">Win</p>
                <div className="flex flex-wrap gap-1">
                  {advice.winCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-up/15 text-signal-up px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.loseCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-signal-down uppercase tracking-wider mb-1.5">Lose</p>
                <div className="flex flex-wrap gap-1">
                  {advice.loseCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-down/15 text-signal-down px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.tossupCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-signal-watch uppercase tracking-wider mb-1.5">Tossup</p>
                <div className="flex flex-wrap gap-1">
                  {advice.tossupCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-watch/15 text-signal-watch px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {advice.keyNote && (
            <p className="text-xs text-ink-secondary border-t border-surface-line pt-3 leading-relaxed">
              {advice.keyNote}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

const SLOT_CONFIG_KEYS = [
  'pgSlots', 'sgSlots', 'gSlots', 'sfSlots', 'pfSlots', 'fSlots', 'cSlots', 'utilSlots', 'bnSlots',
  'firstSlots', 'secondSlots', 'thirdSlots', 'ssSlots', 'ofSlots', 'spSlots', 'rpSlots',
]

// PocketBeane Advisors panel entry point for start/sit decisions — sport-aware
// per league.config.sport (see getStartSitMode in sports.js):
//   'pitching-starts' (MLB) — replaced entirely by PitchingStartsPanel below,
//     everyday hitters don't need a positional start/sit call.
//   'condensed' (NBA/NHL) — 3-line-max per player, no matchup prose.
//   'full' (NFL, default) — original detailed per-position treatment.
function StartSitPanel({ league, rosters }) {
  const sport = league.config.sport ?? 'nba'
  const mode = getStartSitMode(sport)

  if (mode === 'pitching-starts') {
    return <PitchingStartsPanel rosters={rosters} />
  }

  return <LineupAdvisorPanel league={league} rosters={rosters} sport={sport} mode={mode} />
}

function LineupAdvisorPanel({ league, rosters, sport, mode }) {
  const [advice, setAdvice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // mlb routes to PitchingStartsPanel above and never reaches this component —
  // the remaining sports (nba/nhl/nfl) don't have a players.json equivalent
  // of their own yet, so nbaPlayers is the only real pool to look trend
  // badges up against (nhl/nfl simply won't match, which findPlayerByName
  // already handles gracefully by rendering no badge).
  const players = nbaPlayers
  const supported = hasScheduleSupport(sport)
  const condensed = mode === 'condensed'

  async function handleGetAdvice() {
    setLoading(true)
    setError(null)
    try {
      const rosterConfig = Object.fromEntries(
        SLOT_CONFIG_KEYS.filter(k => league.config[k] != null).map(k => [k, league.config[k]])
      )
      const res = await fetch('/api/season/startsit-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport,
          leagueRosters: rosters,
          rosterConfig,
          gmProfile: { injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate' },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Advice failed')
      setAdvice(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Start / Sit Advisor</p>
          <p className="text-xs text-ink-secondary mt-0.5">
            {condensed
              ? 'Optimal lineup by games this week, injury status, and recent form.'
              : 'Optimal weekly lineup given schedule, recent form, and injury status.'}
          </p>
        </div>
        {supported ? (
          <button
            onClick={handleGetAdvice}
            disabled={loading}
            className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {advice ? 'Refresh' : "Get Beane's Take"}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-signal-watch/60 font-mono">Not available for {sport.toUpperCase()} yet</span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Setting your lineup…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-signal-down font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-3">
          {advice.week && (
            <p className="text-xs text-ink-secondary font-mono tabular-nums">
              Week of {advice.week.start} – {advice.week.end}
            </p>
          )}
          {advice.headline && (
            <p className="text-xs text-ink-secondary italic leading-relaxed">{advice.headline}</p>
          )}
          {advice.startingLineup?.length > 0 && (
            <div className="space-y-2">
              {advice.startingLineup.map((entry, i) => {
                const player = findPlayerByName(players, entry.player)
                const hurt = entry.injuryStatus && entry.injuryStatus !== 'healthy'
                return (
                  <div key={i} className="border border-surface-line rounded-md px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-overlay text-ink-secondary">
                        {entry.slot}
                      </span>
                      <span className="text-xs text-ink-primary font-medium flex items-center">
                        {entry.player}
                        <TrendBadge player={player} />
                      </span>
                      {!condensed && entry.gamesThisWeek != null && (
                        <span className="text-[10px] font-mono tabular-nums text-ink-secondary">
                          {entry.gamesThisWeek}g{entry.backToBack ? ' · B2B' : ''}
                        </span>
                      )}
                    </div>
                    {condensed ? (
                      <>
                        <p className="text-[11px] text-ink-secondary font-mono tabular-nums">
                          {entry.gamesThisWeek != null ? `${entry.gamesThisWeek}g this week${entry.backToBack ? ' · B2B' : ''}` : ''}
                          {hurt && (
                            <span className="text-signal-watch/80"> · {INJURY_LABELS[entry.injuryStatus] ?? entry.injuryStatus}</span>
                          )}
                        </p>
                        {entry.reason && <p className="text-xs text-ink-secondary">{entry.reason}</p>}
                      </>
                    ) : (
                      <p className="text-xs text-ink-secondary leading-relaxed">{entry.reason}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {advice.benchNotes?.length > 0 && (
            <div className="pt-3 border-t border-surface-line space-y-2">
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">Bench notes</p>
              {advice.benchNotes.map((note, i) => {
                const hurt = note.injuryStatus && note.injuryStatus !== 'healthy'
                return (
                  <p key={i} className="text-xs text-ink-secondary leading-relaxed">
                    <span className="text-ink-primary">{note.player}</span>
                    {hurt && <span className="text-signal-watch/80 font-mono"> [{INJURY_LABELS[note.injuryStatus] ?? note.injuryStatus}]</span>}
                    : {note.reason}
                  </p>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// MLB's Start/Sit replacement — everyday hitters don't need a positional
// start/sit call, so this shows scheduled starts for rostered SPs with a
// simple start/stream/hold recommendation instead of a full weekly lineup.
function PitchingStartsPanel({ rosters }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleCheckStarts() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/season/pitching-starts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueRosters: rosters }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Pitching starts lookup failed')
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Pitching Starts</p>
          <p className="text-xs text-ink-secondary mt-0.5">
            Scheduled starts this week for your rostered SPs, with a start / stream / hold call.
          </p>
        </div>
        <button
          onClick={handleCheckStarts}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {data ? 'Refresh' : 'Check Starts'}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Checking the rotation…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-signal-down font-mono mt-4">{error}</p>
      )}

      {data && !loading && (
        <div className="mt-4 space-y-3">
          {data.week && (
            <p className="text-xs text-ink-secondary font-mono tabular-nums">
              Week of {data.week.start} – {data.week.end}
            </p>
          )}
          {data.starts?.length > 0 ? (
            <div className="space-y-2">
              {data.starts.map((s, i) => {
                const hurt = s.injuryStatus && s.injuryStatus !== 'healthy'
                return (
                  <div key={i} className="border border-surface-line rounded-md px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-ink-primary font-medium">
                        {s.player} <span className="text-ink-muted font-mono">{s.team}</span>
                      </p>
                      <p className="text-[11px] text-ink-secondary font-mono tabular-nums mt-0.5">
                        Team plays {s.teamGamesThisWeek} time{s.teamGamesThisWeek === 1 ? '' : 's'} this week
                        {hurt && (
                          <span className="text-signal-watch/80">
                            {' '}· {INJURY_LABELS[s.injuryStatus] ?? s.injuryStatus}{s.injuryNote ? `: ${s.injuryNote}` : ''}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded uppercase ${PITCHING_REC_STYLES[s.recommendation] ?? PITCHING_REC_STYLES.hold}`}>
                      {s.recommendation}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-ink-secondary">No rostered starting pitchers found.</p>
          )}
        </div>
      )}
    </Card>
  )
}

// Turns the -100..100 favorScore into a plain-language statement, naming
// whichever side (the user or the trade partner) the score favors.
function favorStatement(score, partnerTeamName) {
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
const FAVOR_TRACK_GRADIENT =
  'linear-gradient(to right, rgb(var(--color-signal-down)) 0%, rgb(var(--color-signal-watch)) 25%, rgb(var(--color-signal-up)) 50%, rgb(var(--color-signal-watch)) 75%, rgb(var(--color-signal-down)) 100%)'

// A full-width scale with a single arrow marker landing at the point
// corresponding to how lopsided the trade is — works the same whether the
// user proposed the trade or is evaluating one they were offered, since
// nothing is "filled in" toward either side as the implied right answer.
function TradeFavorBar({ favorScore, partnerTeamName }) {
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
function TradePlayerToggle({ player, selected, onToggle }) {
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

function TradeAnalyzerPanel({ league, rosters }) {
  const userTeam = rosters.teams.find(t => t.isUser)
  const otherTeams = rosters.teams.filter(t => !t.isUser)

  const [give, setGive] = useState([])
  const [receiveTeamKey, setReceiveTeamKey] = useState('')
  const [receive, setReceive] = useState([])
  const [advice, setAdvice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const sport = league.config.sport ?? 'nba'

  const gmProfile = {
    injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
    draftStrategy: league.config.philosophy?.strategy ?? 'beane',
  }
  const rosterConfig = { ilSlots: league.config.ilSlots, ilPlusSlots: league.config.ilPlusSlots }

  const receiveTeam = otherTeams.find(t => t.teamKey === receiveTeamKey) ?? null

  function toggleGive(name) {
    setGive(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  function toggleReceive(name) {
    setReceive(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  function handleReceiveTeamChange(teamKey) {
    setReceiveTeamKey(teamKey)
    setReceive([]) // a trade only involves one opposing team — switching resets the picks
  }

  async function handleGetAdvice() {
    if (!give.length || !receive.length) {
      setError('Pick at least one player on each side of the trade.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/season/trade-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, leagueRosters: rosters, give, receive, gmProfile, rosterConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Advice failed')
      setAdvice(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="mb-3">
        <p className="text-sm font-semibold text-ink-primary">Trade Analyzer</p>
        <p className="text-xs text-ink-secondary mt-0.5">
          Pick players from your roster and an opponent's to see the net category impact, positional fit, and buy-low/sell-high signal.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">
            You give {give.length > 0 && <span className="text-beane-green-text tabular-nums">({give.length})</span>}
          </label>
          <div className="mt-1 space-y-1 max-h-64 overflow-y-auto pr-1">
            {userTeam?.roster.map(p => (
              <TradePlayerToggle
                key={p.playerId ?? p.name}
                player={p}
                selected={give.includes(p.name)}
                onToggle={() => toggleGive(p.name)}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">
            You receive {receive.length > 0 && <span className="text-beane-green-text tabular-nums">({receive.length})</span>}
          </label>
          <select
            value={receiveTeamKey}
            onChange={(e) => handleReceiveTeamChange(e.target.value)}
            className="mt-1 w-full bg-surface-base border border-surface-line rounded px-2.5 py-1.5 text-xs text-ink-primary focus:outline-none focus:border-beane-green/50"
          >
            <option value="">Select opponent…</option>
            {otherTeams.map(t => (
              <option key={t.teamKey} value={t.teamKey}>{t.teamName}</option>
            ))}
          </select>
          <div className="mt-1.5 space-y-1 max-h-56 overflow-y-auto pr-1">
            {receiveTeam ? (
              receiveTeam.roster.map(p => (
                <TradePlayerToggle
                  key={p.playerId ?? p.name}
                  player={p}
                  selected={receive.includes(p.name)}
                  onToggle={() => toggleReceive(p.name)}
                />
              ))
            ) : (
              <p className="text-xs text-ink-muted px-1 py-1">Pick an opponent to see their roster.</p>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleGetAdvice}
        disabled={loading}
        className="text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {advice ? 'Refresh' : "Get Beane's Take"}
      </button>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Weighing the trade…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-signal-down font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-4">
          <TradeFavorBar favorScore={advice.favorScore} partnerTeamName={advice.partnerTeamName ?? 'Opponent'} />
          {advice.outlook && (
            <p className="text-xs text-ink-secondary leading-relaxed italic">{advice.outlook}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {advice.improveCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-signal-up uppercase tracking-wider mb-1.5">Improves</p>
                <div className="flex flex-wrap gap-1">
                  {advice.improveCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-up/15 text-signal-up px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.declineCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-signal-down uppercase tracking-wider mb-1.5">Declines</p>
                <div className="flex flex-wrap gap-1">
                  {advice.declineCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-down/15 text-signal-down px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.neutralCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-ink-secondary uppercase tracking-wider mb-1.5">Neutral</p>
                <div className="flex flex-wrap gap-1">
                  {advice.neutralCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-surface-overlay text-ink-secondary px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {advice.positionalNote && (
            <p className="text-xs text-ink-secondary border-t border-surface-line pt-3 leading-relaxed">
              <span className="text-ink-primary font-medium">Positional fit:</span> {advice.positionalNote}
            </p>
          )}
          {advice.buyLowSellHighNote && (
            <p className="text-xs text-ink-secondary leading-relaxed">
              <span className="text-ink-primary font-medium">Buy-low/sell-high:</span> {advice.buyLowSellHighNote}
            </p>
          )}
          {advice.reason && (
            <p className="text-xs text-ink-secondary leading-relaxed">{advice.reason}</p>
          )}
        </div>
      )}
    </Card>
  )
}

function TradeValueIndexPanel({ league, rosters }) {
  const [index, setIndex] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const sport = league.config.sport ?? 'nba'

  const gmProfile = {
    injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
    draftStrategy: league.config.philosophy?.strategy ?? 'beane',
  }
  const rosterConfig = { ilSlots: league.config.ilSlots, ilPlusSlots: league.config.ilPlusSlots }

  async function handleGetIndex() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/season/trade-value-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, leagueRosters: rosters, gmProfile, rosterConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Index failed')
      setIndex(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Trade Value Index</p>
          <p className="text-xs text-ink-secondary mt-0.5">
            Sell-high candidates on your roster and buy-low targets across the league.
          </p>
        </div>
        <button
          onClick={handleGetIndex}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {index ? 'Refresh' : "Get Beane's Take"}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Scanning trade value…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-signal-down font-mono mt-4">{error}</p>
      )}

      {index && !loading && (
        <div className="mt-4 space-y-4">
          {index.headline && (
            <p className="text-xs text-ink-secondary italic leading-relaxed">{index.headline}</p>
          )}
          {index.sellHigh?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-signal-up uppercase tracking-wider">Sell high (your roster)</p>
              {index.sellHigh.map((entry, i) => (
                <div key={i} className="border border-surface-line rounded-md px-4 py-3">
                  <p className="text-xs text-signal-up font-medium mb-1">{entry.player}</p>
                  <p className="text-xs text-ink-secondary leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
          {index.buyLowTargets?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-surface-line">
              <p className="text-[10px] font-mono text-signal-info uppercase tracking-wider pt-2">Buy low (league targets)</p>
              {index.buyLowTargets.map((entry, i) => (
                <div key={i} className="border border-surface-line rounded-md px-4 py-3">
                  <p className="text-xs text-signal-info font-medium mb-1">
                    {entry.player}
                    {entry.currentTeam && <span className="text-ink-muted font-normal"> · {entry.currentTeam}</span>}
                  </p>
                  <p className="text-xs text-ink-secondary leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
          {!index.sellHigh?.length && !index.buyLowTargets?.length && (
            <p className="text-xs text-ink-secondary">No standout sell-high or buy-low signals this week.</p>
          )}
        </div>
      )}
    </Card>
  )
}

const TIER_STYLES = {
  contender:  { label: 'Contender',      color: 'text-signal-up',    bg: 'bg-signal-up/10 border-signal-up/20' },
  bubble:     { label: 'Playoff Bubble', color: 'text-signal-watch', bg: 'bg-signal-watch/10 border-signal-watch/20' },
  rebuilding: { label: 'Rebuilding',     color: 'text-signal-down',  bg: 'bg-signal-down/10 border-signal-down/20' },
}

const STANDING_TREND_ARROW = {
  up:   { icon: '↑', color: 'text-signal-up' },
  down: { icon: '↓', color: 'text-signal-down' },
  flat: { icon: '→', color: 'text-ink-secondary' },
}

const WIN_RATE_GRADE_STYLES = {
  strong: 'text-signal-up bg-signal-up/10 border-signal-up/20',
  ok:     'text-signal-watch bg-signal-watch/10 border-signal-watch/20',
  weak:   'text-signal-down bg-signal-down/10 border-signal-down/20',
}

// Deterministic stand-in for the per-team Claude insight when the user's
// team wasn't specifically called out in the league-pulse response (that
// endpoint only covers teams that are "genuinely dominating" or "clearly
// rebuilding" — a solid mid-pack team may not appear in either list).
// Always available, since it's built entirely from the win-rate data above.
function buildFallbackInsight(entry, sportConfig) {
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

// Team Pulse — combines the never-shipped Roster Health Score (now a
// deterministic Contender/Bubble/Rebuilding tier + trend arrow, rather than
// a fabricated 1-10 number) with League Pulse (unchanged endpoint/logic,
// called from here instead of its own standalone panel). Tier, trend, and
// category win rates are pure client-side math over data already on the
// page — no fetch needed for those. The per-team Claude insight and the
// trade-opportunity flags are still real LLM calls, gated behind a button
// like every other advisor in this file.
function TeamPulsePanel({ league, rosters }) {
  const sport = league.config.sport ?? 'nba'
  const sportConfig = getSportConfig(sport)
  const players = sport === 'mlb' ? mlbPlayers : nbaPlayers

  const [pulse, setPulse] = useState(null)
  const [pulseLoading, setPulseLoading] = useState(false)
  const [pulseError, setPulseError] = useState(null)

  const [tradeFlags, setTradeFlags] = useState(null)
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeError, setTradeError] = useState(null)

  const gmProfile = {
    injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
    draftStrategy: league.config.philosophy?.strategy ?? 'beane',
  }
  const rosterConfig = { ilSlots: league.config.ilSlots, ilPlusSlots: league.config.ilPlusSlots }

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

  async function handleGetInsight() {
    setPulseLoading(true)
    setPulseError(null)
    try {
      const res = await fetch('/api/season/league-pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, leagueRosters: rosters, gmProfile, rosterConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pulse failed')
      setPulse(data)
    } catch (err) {
      setPulseError(err.message)
    } finally {
      setPulseLoading(false)
    }
  }

  async function handleGetTradeFlags() {
    setTradeLoading(true)
    setTradeError(null)
    try {
      const res = await fetch('/api/season/trade-value-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, leagueRosters: rosters, gmProfile, rosterConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Trade scan failed')
      setTradeFlags(data.tradeOpportunityFlags ?? [])
    } catch (err) {
      setTradeError(err.message)
    } finally {
      setTradeLoading(false)
    }
  }

  const { teams, userEntry, trend } = standing
  if (!userEntry) return null

  const userTeam = userEntry.team
  const tierStyle = TIER_STYLES[userEntry.tier] ?? null
  const trendArrow = trend ? STANDING_TREND_ARROW[trend] : null

  // myTeamTake is always present in a well-formed response (job 4 of the
  // league-pulse prompt runs regardless of whether I show up in the
  // dominating/rebuilding lists) — the dominating/rebuilding note and the
  // deterministic fallback are only reached if the model omits it.
  const pulseNote = pulse
    ? pulse.dominating?.find(e => e.team === userTeam.teamName)?.note
        ?? pulse.rebuilding?.find(e => e.team === userTeam.teamName)?.note
        ?? null
    : null
  const insight = pulse
    ? (pulse.myTeamTake ? null : (pulseNote ?? buildFallbackInsight(userEntry, sportConfig)))
    : null

  return (
    <Card>
      <p className="text-sm font-semibold text-ink-primary mb-3">Team Pulse</p>

      {/* 1. User's team position */}
      <div className="border border-surface-line rounded-md px-4 py-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {tierStyle && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${tierStyle.bg} ${tierStyle.color}`}>
              {tierStyle.label}
            </span>
          )}
          {trendArrow && <span className={`text-sm font-mono ${trendArrow.color}`}>{trendArrow.icon}</span>}
          <span className="text-xs text-ink-primary font-medium">{userTeam.teamName} · #{userTeam.rank ?? '?'}</span>
          <span className="text-[11px] font-mono tabular-nums text-ink-secondary">
            {userTeam.wins}-{userTeam.losses}{userTeam.ties ? `-${userTeam.ties}` : ''}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {sportConfig.categories.map(cat => {
            const wr = userEntry.winRates[cat.id]
            const grade = getWinRateGrade(wr?.rate ?? null)
            return (
              <span
                key={cat.id}
                title={wr ? `Beats ${wr.wins}/${wr.of} teams in ${cat.label}` : 'Not enough data yet'}
                className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded border ${grade ? WIN_RATE_GRADE_STYLES[grade] : 'text-ink-muted bg-surface-overlay border-surface-line'}`}
              >
                {cat.label} {wr?.rate != null ? `${Math.round(wr.rate * 100)}%` : '—'}
              </span>
            )
          })}
        </div>

        {!pulse && !pulseLoading && (
          <button
            onClick={handleGetInsight}
            className="text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors"
          >
            Get Beane's Take
          </button>
        )}
        {pulseLoading && <p className="text-xs text-ink-secondary font-mono animate-pulse">Reading the league…</p>}
        {pulseError && !pulseLoading && <p className="text-xs text-signal-down font-mono">{pulseError}</p>}
        {pulse?.myTeamTake && !pulseLoading && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-secondary leading-relaxed">{pulse.myTeamTake.summary}</p>
            {pulse.myTeamTake.strengths && (
              <p className="text-xs text-ink-secondary leading-relaxed">
                <span className="text-signal-up/80 font-medium">Strengths: </span>{pulse.myTeamTake.strengths}
              </p>
            )}
            {pulse.myTeamTake.weaknesses && (
              <p className="text-xs text-ink-secondary leading-relaxed">
                <span className="text-signal-down/80 font-medium">Weaknesses: </span>{pulse.myTeamTake.weaknesses}
              </p>
            )}
            {pulse.myTeamTake.recommendation && (
              <p className="text-xs text-ink-secondary leading-relaxed">
                <span className="text-beane-green-text font-medium">Move or hold: </span>{pulse.myTeamTake.recommendation}
              </p>
            )}
          </div>
        )}
        {insight && !pulseLoading && <p className="text-xs text-ink-secondary leading-relaxed">{insight}</p>}
      </div>

      {/* 2. League landscape */}
      <div className="mb-4">
        <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-2">League Landscape</p>
        <div className="space-y-1">
          {teams.map(({ team, tier, overallWinRate }) => {
            const style = TIER_STYLES[tier] ?? null
            return (
              <div
                key={team.teamKey}
                className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs px-2 py-1 rounded border ${style ? style.bg : 'border-transparent'}`}
              >
                <span className={`font-medium ${style ? style.color : 'text-ink-secondary'}`}>
                  #{team.rank ?? '?'} {team.teamName}{team.isUser ? ' (ME)' : ''}
                </span>
                <span className="font-mono tabular-nums text-ink-secondary text-[11px]">
                  {team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ''}
                  {overallWinRate != null ? ` · ${Math.round(overallWinRate * 100)}% cat wins` : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Trade opportunity flags */}
      <div className="pt-3 border-t border-surface-line">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">Trade Opportunities</p>
          {!tradeFlags && !tradeLoading && (
            <button
              onClick={handleGetTradeFlags}
              className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors"
            >
              Scan for fits
            </button>
          )}
        </div>
        {tradeLoading && <p className="text-xs text-ink-secondary font-mono animate-pulse">Cross-referencing rosters…</p>}
        {tradeError && !tradeLoading && <p className="text-xs text-signal-down font-mono">{tradeError}</p>}
        {tradeFlags && !tradeLoading && (
          tradeFlags.length > 0 ? (
            <div className="space-y-1.5">
              {tradeFlags.map((flag, i) => (
                <p key={i} className="text-xs text-ink-secondary leading-relaxed">
                  <span className="text-ink-primary font-medium">{flag.player} ({flag.team}):</span> {flag.reason}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-secondary">No standout trade fits right now.</p>
          )
        )}
      </div>
    </Card>
  )
}

const TROPHY_BY_RANK = { 1: '🥇', 2: '🥈', 3: '🥉' }

// One-time end-of-season recap: fires exactly once per league (guarded by
// `league.seasonRecap` already being set, and an in-flight ref so a fast
// re-render can't double-fire), built from whatever roster/standings
// snapshot was last cached before Yahoo locked the league down — there's no
// live pull possible once a season's over, so this is as final as it gets.
function SeasonRecapPanel({ league, rosters }) {
  const { setSeasonRecap } = useLeagueStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const attempted = useRef(false)
  const recap = league.seasonRecap
  const hasFinalRoster = Boolean(rosters?.teams?.length)

  useEffect(() => {
    if (recap || !hasFinalRoster || attempted.current) return
    attempted.current = true
    setLoading(true)
    setError(null)

    async function run() {
      try {
        const sport = league.config.sport ?? 'nba'
        const res = await fetch('/api/season/season-recap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sport,
            leagueRosters: rosters,
            gmProfile: {
              injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
              draftStrategy: league.config.philosophy?.draftStrategy,
            },
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Recap failed')
        setSeasonRecap(league.id, data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [recap, hasFinalRoster])

  if (!hasFinalRoster) return null

  return (
    <div className="bg-surface-raised border border-surface-line rounded-lg px-5 py-6 mb-6">
      {loading && !recap && (
        <p className="text-xs text-ink-secondary font-mono animate-pulse">Putting together your season recap…</p>
      )}
      {error && !recap && !loading && (
        <p className="text-xs text-signal-down font-mono">{error}</p>
      )}
      {recap && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {TROPHY_BY_RANK[recap.rank] && (
              <span className="text-4xl leading-none">{TROPHY_BY_RANK[recap.rank]}</span>
            )}
            <div>
              <p className="text-sm font-semibold text-ink-primary">
                Finished #{recap.rank ?? '?'} of {recap.numTeams} — {recap.teamName}
              </p>
              <p className="text-xs text-ink-secondary font-mono tabular-nums">
                {recap.wins}-{recap.losses}{recap.ties ? `-${recap.ties}` : ''}
              </p>
            </div>
          </div>

          {recap.headline && <p className="text-sm text-ink-primary italic leading-relaxed">{recap.headline}</p>}
          {recap.summary && <p className="text-xs text-ink-secondary leading-relaxed">{recap.summary}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-surface-line">
            {recap.strengths && (
              <p className="text-xs text-ink-secondary leading-relaxed">
                <span className="text-signal-up font-mono">What worked — </span>{recap.strengths}
              </p>
            )}
            {recap.weaknesses && (
              <p className="text-xs text-ink-secondary leading-relaxed">
                <span className="text-signal-down font-mono">What held you back — </span>{recap.weaknesses}
              </p>
            )}
          </div>

          {recap.lookAhead && (
            <p className="text-xs text-ink-secondary leading-relaxed border-t border-surface-line pt-3">
              <span className="text-signal-info font-mono">Next season — </span>{recap.lookAhead}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SeasonHub() {
  const router = useRouter()
  const league = useLeagueStore((s) => s.getActiveLeague())
  const { setLeagueRosters, updateLeagueConfig } = useLeagueStore()
  const yahoo = useYahooAuth()
  const [mounted, setMounted] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const autoSyncAttempted = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  const canSync = Boolean(league?.config.yahooLeagueKey)
  const rosters = league?.leagueRosters ?? null
  // Either surface can learn the season is over first (this page's own sync,
  // or the home page's draft Re-sync hitting the same Yahoo 403) — trust
  // whichever one has already found out.
  const seasonOver = Boolean(league?.config.isSeasonOver) || Boolean(rosters?.isSeasonOver)

  async function handleSync() {
    if (!league?.config.yahooLeagueKey) return
    setSyncing(true)
    setSyncError(null)
    try {
      const sport = league.config.sport ?? 'nba'
      const res = await fetch(`/api/yahoo/sync-rosters?leagueKey=${encodeURIComponent(league.config.yahooLeagueKey)}&sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      // On a season-over detection, the response has no `teams` (the call
      // that would carry them is exactly what 403'd) — merge onto whatever
      // was last cached instead of overwriting it, so the final roster/
      // standings snapshot survives for the season recap below.
      setLeagueRosters(league.id, data.isSeasonOver ? { ...(rosters ?? {}), ...data } : data)
      if (data.isSeasonOver) updateLeagueConfig(league.id, { isSeasonOver: true })
    } catch (err) {
      setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const isArchived = league?.status === 'complete'

  useEffect(() => {
    if (!mounted || !canSync || !yahoo.connected || autoSyncAttempted.current || isArchived || seasonOver) return
    if (isSyncStale(rosters?.syncedAt)) {
      autoSyncAttempted.current = true
      handleSync()
    }
  }, [mounted, yahoo.connected, canSync, isArchived, seasonOver])

  if (!mounted) return null

  if (!league) {
    return (
      <div className="min-h-screen bg-surface-base text-ink-primary flex items-center justify-center">
        <p className="text-ink-secondary text-sm">No active league. <button onClick={() => router.push('/')} className="text-beane-green-text hover:underline">Go home →</button></p>
      </div>
    )
  }

  if (isArchived) {
    return (
      <>
        <Head>
          <title>{league.config.name || 'Season Hub'} — PocketBeane</title>
        </Head>
        <main className="min-h-screen bg-surface-base text-ink-primary">
          <div className="max-w-3xl mx-auto px-8 py-12">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-ink-primary tracking-tight">
                {league.config.name || 'Season Hub'}
              </h1>
              <button
                onClick={() => router.push('/')}
                className="text-xs text-ink-secondary hover:text-ink-primary transition-colors"
              >
                ← Home
              </button>
            </div>
            {seasonOver && <SeasonRecapPanel league={league} rosters={rosters} />}
            <div className="bg-surface-raised border border-surface-line rounded-lg px-5 py-6">
              <p className="text-sm font-semibold text-ink-primary mb-1.5">Season complete</p>
              {seasonOver ? (
                <p className="text-xs text-ink-secondary leading-relaxed">
                  This league's season has ended, so the Season Hub tools aren't available for it anymore
                  — Yahoo no longer serves any live data for it, archived or not.
                </p>
              ) : (
                <p className="text-xs text-ink-secondary leading-relaxed">
                  This league is archived, so the season advisors (waiver wire, matchup, start/sit) aren't
                  shown here — they run against live rosters, and an archived league's roster snapshot is
                  frozen from whenever it was archived. To keep managing this league, unarchive it from the
                  home page first.
                </p>
              )}
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{league.config.name || 'Season Hub'} — PocketBeane</title>
      </Head>
      <main className="min-h-screen bg-surface-base text-ink-primary">
        <div className="max-w-3xl mx-auto px-8 py-12">

          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold text-ink-primary tracking-tight">
                {league.config.name || 'Season Hub'}
              </h1>
              <p className="text-ink-secondary text-sm mt-0.5">
                {league.config.numTeams} teams · {league.config.scoringFormat?.toUpperCase() ?? '9CAT'}
                {league.config.yahooLeagueName && (
                  <span className="ml-2 text-ink-muted">· {league.config.yahooLeagueName}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-xs text-ink-secondary hover:text-ink-primary transition-colors"
            >
              ← Home
            </button>
          </div>

          <p className="text-xs text-signal-info font-mono mb-8">Season Mode</p>

          {/* Sync status */}
          {canSync ? (
            <div className="flex items-center gap-2 mb-10 text-xs font-mono">
              {syncing ? (
                <span className="text-ink-secondary">Syncing rosters…</span>
              ) : seasonOver ? (
                <>
                  <span className="text-ink-muted tabular-nums">
                    {rosters?.syncedAt ? `Checked ${formatSyncedAt(rosters.syncedAt)} · season complete` : 'Season complete'}
                  </span>
                  {yahoo.connected && (
                    <button
                      onClick={handleSync}
                      className="text-ink-muted hover:text-ink-secondary transition-colors ml-1"
                      title="Force a re-check with Yahoo — the season won't have restarted, this is just a safety valve"
                    >
                      · Re-check
                    </button>
                  )}
                </>
              ) : rosters ? (
                <>
                  <span className="text-ink-muted tabular-nums">
                    Synced {formatSyncedAt(rosters.syncedAt)} · {rosters.matched}/{rosters.total} matched
                  </span>
                  {yahoo.connected && (
                    <button
                      onClick={handleSync}
                      className="text-ink-muted hover:text-ink-primary transition-colors ml-1"
                    >
                      · Refresh
                    </button>
                  )}
                </>
              ) : yahoo.connected ? (
                <span className="text-ink-secondary">Syncing rosters…</span>
              ) : (
                <span className="text-signal-watch/70">Connect Yahoo to sync rosters</span>
              )}
              {syncError && <span className="text-signal-down ml-2">{syncError}</span>}
            </div>
          ) : (
            <Card className="mb-10">
              <p className="text-sm text-ink-secondary">
                This league isn't linked to Yahoo.{' '}
                <button onClick={() => router.push(`/setup?id=${league.id}`)} className="text-beane-green-text hover:underline">
                  Edit league settings →
                </button>
              </p>
            </Card>
          )}

          {/* Active advisors — only when rosters are available */}
          {seasonOver ? (
            <div className="mb-8">
              <SeasonRecapPanel league={league} rosters={rosters} />
              <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mb-3">Season Advisors</p>
              <div className="bg-surface-raised border border-surface-line rounded-lg px-5 py-6">
                <p className="text-sm font-semibold text-ink-primary mb-1.5">Season complete</p>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  The season has ended, so the Season Hub tools aren't available for this league anymore.
                  Come back once a new season starts and this league is re-synced.
                </p>
              </div>
            </div>
          ) : rosters ? (
            <div className="space-y-4 mb-8">
              <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mb-3">Season Advisors</p>
              <WaiverPanel league={league} rosters={rosters} />
              <MatchupPanel league={league} rosters={rosters} yahooConnected={yahoo.connected} />
              <StartSitPanel league={league} rosters={rosters} />
              <TradeAnalyzerPanel league={league} rosters={rosters} />
              <TradeValueIndexPanel league={league} rosters={rosters} />
              <TeamPulsePanel league={league} rosters={rosters} />
            </div>
          ) : canSync ? (
            <div className="mb-8">
              <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mb-3">Season Advisors</p>
              <Card className="text-xs text-ink-secondary">
                {yahoo.connected
                  ? 'Sync your rosters above to unlock the season advisors.'
                  : 'Connect Yahoo and sync your rosters to unlock the season advisors.'}
              </Card>
            </div>
          ) : null}

          {/* Coming soon features */}
          {COMING_SOON.length > 0 && (
            <div>
              <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mb-3">Coming Soon</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COMING_SOON.map((f) => (
                  <div
                    key={f.title}
                    className="bg-surface-raised border border-surface-line rounded-lg px-5 py-4 opacity-50"
                  >
                    <p className="text-sm font-semibold text-ink-primary mb-1">{f.title}</p>
                    <p className="text-xs text-ink-secondary">{f.description}</p>
                    <p className="text-xs text-ink-muted mt-3 font-mono">Coming soon</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
