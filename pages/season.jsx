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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

const TREND_STYLES = {
  improving: { icon: '↑', color: 'text-green-400' },
  'slightly-improving': { icon: '↗', color: 'text-green-400/70' },
  stable:    { icon: '→', color: 'text-gray-400' },
  'slightly-declining': { icon: '↘', color: 'text-red-400/70' },
  declining: { icon: '↓', color: 'text-red-400' },
}

// Condensed Start/Sit rendering (NBA/NHL) shows injury status as its own
// short tag rather than folding it into prose — see startSitMode in sports.js.
const INJURY_LABELS = {
  'day-to-day': 'DTD',
  il: 'IL',
  out: 'OUT',
  ir: 'IR',
}

const PITCHING_REC_STYLES = {
  start: 'bg-green-900/40 text-green-400',
  stream: 'bg-blue-900/40 text-blue-400',
  hold: 'bg-gray-800 text-gray-500',
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
      className={`ml-1 text-[10px] font-mono whitespace-nowrap ${stale ? 'text-gray-600' : style.color}`}
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
  'must-add': 'bg-green-900/40 text-green-400',
  'consider': 'bg-blue-900/40 text-blue-400',
  'speculative': 'bg-gray-800 text-gray-500',
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
    <div className="bg-surface border border-border rounded-lg px-5 py-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-gray-200">Waiver Wire Advisor</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Recommended adds and drops based on your roster gaps and available free agents.
          </p>
        </div>
        <button
          onClick={handleGetAdvice}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {advice ? 'Refresh' : "Get Beane's Take"}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-gray-500 font-mono mt-4 animate-pulse">Analyzing your roster…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-3">
          {advice.headline && (
            <p className="text-xs text-gray-400 italic leading-relaxed">{advice.headline}</p>
          )}
          {advice.moves?.map((move, i) => {
            const addPlayer = findPlayerByName(players, move.add)
            const dropPlayer = move.drop ? findPlayerByName(players, move.drop) : null
            return (
              <div key={i} className="border border-border rounded-md px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${PRIORITY_STYLES[move.priority] ?? 'bg-gray-800 text-gray-500'}`}>
                    {move.priority ?? 'add'}
                  </span>
                  <span className="text-xs text-green-400 font-medium flex items-center">
                    + {move.add}
                    <TrendBadge player={addPlayer} />
                  </span>
                  {move.drop && (
                    <>
                      <span className="text-gray-700 text-xs">·</span>
                      <span className="text-xs text-red-400 flex items-center">
                        − {move.drop}
                        <TrendBadge player={dropPlayer} />
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{move.reason}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
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
    <div className="bg-surface border border-border rounded-lg px-5 py-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-gray-200">Head-to-Head Matchup Advisor</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Weekly category projections vs. your current opponent with lineup suggestions.
          </p>
        </div>
        {canRun ? (
          <button
            onClick={handleGetAdvice}
            disabled={loading}
            className="shrink-0 text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {advice ? 'Refresh' : "Get Beane's Take"}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-yellow-500/60 font-mono">Needs Yahoo</span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-500 font-mono mt-4 animate-pulse">Pulling this week's matchup…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-gray-500 font-mono">
            Week {advice.week} vs. {advice.opponent}
          </p>
          {advice.outlook && (
            <p className="text-xs text-gray-400 leading-relaxed italic">{advice.outlook}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {advice.winCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-green-500 uppercase tracking-wider mb-1.5">Win</p>
                <div className="flex flex-wrap gap-1">
                  {advice.winCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.loseCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-red-500 uppercase tracking-wider mb-1.5">Lose</p>
                <div className="flex flex-wrap gap-1">
                  {advice.loseCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.tossupCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-yellow-500 uppercase tracking-wider mb-1.5">Tossup</p>
                <div className="flex flex-wrap gap-1">
                  {advice.tossupCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {advice.keyNote && (
            <p className="text-xs text-gray-500 border-t border-border pt-3 leading-relaxed">
              {advice.keyNote}
            </p>
          )}
        </div>
      )}
    </div>
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
    <div className="bg-surface border border-border rounded-lg px-5 py-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-gray-200">Start / Sit Advisor</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {condensed
              ? 'Optimal lineup by games this week, injury status, and recent form.'
              : 'Optimal weekly lineup given schedule, recent form, and injury status.'}
          </p>
        </div>
        {supported ? (
          <button
            onClick={handleGetAdvice}
            disabled={loading}
            className="shrink-0 text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {advice ? 'Refresh' : "Get Beane's Take"}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-yellow-500/60 font-mono">Not available for {sport.toUpperCase()} yet</span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-500 font-mono mt-4 animate-pulse">Setting your lineup…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-3">
          {advice.week && (
            <p className="text-xs text-gray-500 font-mono">
              Week of {advice.week.start} – {advice.week.end}
            </p>
          )}
          {advice.headline && (
            <p className="text-xs text-gray-400 italic leading-relaxed">{advice.headline}</p>
          )}
          {advice.startingLineup?.length > 0 && (
            <div className="space-y-2">
              {advice.startingLineup.map((entry, i) => {
                const player = findPlayerByName(players, entry.player)
                const hurt = entry.injuryStatus && entry.injuryStatus !== 'healthy'
                return (
                  <div key={i} className="border border-border rounded-md px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                        {entry.slot}
                      </span>
                      <span className="text-xs text-gray-200 font-medium flex items-center">
                        {entry.player}
                        <TrendBadge player={player} />
                      </span>
                      {!condensed && entry.gamesThisWeek != null && (
                        <span className="text-[10px] font-mono text-gray-500">
                          {entry.gamesThisWeek}g{entry.backToBack ? ' · B2B' : ''}
                        </span>
                      )}
                    </div>
                    {condensed ? (
                      <>
                        <p className="text-[11px] text-gray-500 font-mono">
                          {entry.gamesThisWeek != null ? `${entry.gamesThisWeek}g this week${entry.backToBack ? ' · B2B' : ''}` : ''}
                          {hurt && (
                            <span className="text-yellow-500/80"> · {INJURY_LABELS[entry.injuryStatus] ?? entry.injuryStatus}</span>
                          )}
                        </p>
                        {entry.reason && <p className="text-xs text-gray-400">{entry.reason}</p>}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 leading-relaxed">{entry.reason}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {advice.benchNotes?.length > 0 && (
            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Bench notes</p>
              {advice.benchNotes.map((note, i) => {
                const hurt = note.injuryStatus && note.injuryStatus !== 'healthy'
                return (
                  <p key={i} className="text-xs text-gray-500 leading-relaxed">
                    <span className="text-gray-300">{note.player}</span>
                    {hurt && <span className="text-yellow-500/80 font-mono"> [{INJURY_LABELS[note.injuryStatus] ?? note.injuryStatus}]</span>}
                    : {note.reason}
                  </p>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
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
    <div className="bg-surface border border-border rounded-lg px-5 py-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-gray-200">Pitching Starts</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Scheduled starts this week for your rostered SPs, with a start / stream / hold call.
          </p>
        </div>
        <button
          onClick={handleCheckStarts}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {data ? 'Refresh' : 'Check Starts'}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-gray-500 font-mono mt-4 animate-pulse">Checking the rotation…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 font-mono mt-4">{error}</p>
      )}

      {data && !loading && (
        <div className="mt-4 space-y-3">
          {data.week && (
            <p className="text-xs text-gray-500 font-mono">
              Week of {data.week.start} – {data.week.end}
            </p>
          )}
          {data.starts?.length > 0 ? (
            <div className="space-y-2">
              {data.starts.map((s, i) => {
                const hurt = s.injuryStatus && s.injuryStatus !== 'healthy'
                return (
                  <div key={i} className="border border-border rounded-md px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-200 font-medium">
                        {s.player} <span className="text-gray-600 font-mono">{s.team}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                        Team plays {s.teamGamesThisWeek} time{s.teamGamesThisWeek === 1 ? '' : 's'} this week
                        {hurt && (
                          <span className="text-yellow-500/80">
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
            <p className="text-xs text-gray-500">No rostered starting pitchers found.</p>
          )}
        </div>
      )}
    </div>
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

// A full-width neutral scale with a single arrow marker landing at the point
// corresponding to how lopsided the trade is — works the same whether the
// user proposed the trade or is evaluating one they were offered, since
// nothing is "filled in" toward either side as the implied right answer.
function TradeFavorBar({ favorScore, partnerTeamName }) {
  const score = Math.max(-100, Math.min(100, favorScore ?? 0))
  const markerPct = (score + 100) / 2 // 0 = fully favors partner, 100 = fully favors user

  return (
    <div>
      <p className="text-sm text-gray-200 font-medium mb-3">{favorStatement(score, partnerTeamName)}</p>
      <div className="flex items-center justify-between text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-1.5">
        <span>{partnerTeamName}</span>
        <span>You</span>
      </div>
      <div className="relative w-full h-1.5">
        <div className="absolute inset-0 bg-white/10 rounded-full" />
        <div
          className="absolute -translate-x-1/2 text-pick"
          style={{
            left: `${markerPct}%`,
            top: '100%',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderBottom: '6px solid currentColor',
          }}
        />
      </div>
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
          ? 'bg-pick/10 border-pick/40 text-pick'
          : 'bg-background border-border text-gray-400 hover:border-gray-600'
      }`}
    >
      {player.name}
      {player.positions && <span className="ml-1.5 font-mono text-[10px] text-gray-600">{player.positions}</span>}
      {hurt && <span className="ml-1.5 font-mono text-[10px] text-yellow-500/80">{player.status}</span>}
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
    <div className="bg-surface border border-border rounded-lg px-5 py-5">
      <div className="mb-3">
        <p className="text-sm font-semibold text-gray-200">Trade Analyzer</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Pick players from your roster and an opponent's to see the net category impact, positional fit, and buy-low/sell-high signal.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
            You give {give.length > 0 && <span className="text-pick">({give.length})</span>}
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
          <label className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
            You receive {receive.length > 0 && <span className="text-pick">({receive.length})</span>}
          </label>
          <select
            value={receiveTeamKey}
            onChange={(e) => handleReceiveTeamChange(e.target.value)}
            className="mt-1 w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-pick/50"
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
              <p className="text-xs text-gray-600 px-1 py-1">Pick an opponent to see their roster.</p>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleGetAdvice}
        disabled={loading}
        className="text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {advice ? 'Refresh' : "Get Beane's Take"}
      </button>

      {loading && (
        <p className="text-xs text-gray-500 font-mono mt-4 animate-pulse">Weighing the trade…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-4">
          <TradeFavorBar favorScore={advice.favorScore} partnerTeamName={advice.partnerTeamName ?? 'Opponent'} />
          {advice.outlook && (
            <p className="text-xs text-gray-400 leading-relaxed italic">{advice.outlook}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {advice.improveCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-green-500 uppercase tracking-wider mb-1.5">Improves</p>
                <div className="flex flex-wrap gap-1">
                  {advice.improveCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.declineCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-red-500 uppercase tracking-wider mb-1.5">Declines</p>
                <div className="flex flex-wrap gap-1">
                  {advice.declineCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.neutralCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Neutral</p>
                <div className="flex flex-wrap gap-1">
                  {advice.neutralCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {advice.positionalNote && (
            <p className="text-xs text-gray-500 border-t border-border pt-3 leading-relaxed">
              <span className="text-gray-400 font-medium">Positional fit:</span> {advice.positionalNote}
            </p>
          )}
          {advice.buyLowSellHighNote && (
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="text-gray-400 font-medium">Buy-low/sell-high:</span> {advice.buyLowSellHighNote}
            </p>
          )}
          {advice.reason && (
            <p className="text-xs text-gray-400 leading-relaxed">{advice.reason}</p>
          )}
        </div>
      )}
    </div>
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
    <div className="bg-surface border border-border rounded-lg px-5 py-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-gray-200">Trade Value Index</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Sell-high candidates on your roster and buy-low targets across the league.
          </p>
        </div>
        <button
          onClick={handleGetIndex}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {index ? 'Refresh' : "Get Beane's Take"}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-gray-500 font-mono mt-4 animate-pulse">Scanning trade value…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 font-mono mt-4">{error}</p>
      )}

      {index && !loading && (
        <div className="mt-4 space-y-4">
          {index.headline && (
            <p className="text-xs text-gray-400 italic leading-relaxed">{index.headline}</p>
          )}
          {index.sellHigh?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-green-500 uppercase tracking-wider">Sell high (your roster)</p>
              {index.sellHigh.map((entry, i) => (
                <div key={i} className="border border-border rounded-md px-4 py-3">
                  <p className="text-xs text-green-400 font-medium mb-1">{entry.player}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
          {index.buyLowTargets?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-[10px] font-mono text-blue-400 uppercase tracking-wider pt-2">Buy low (league targets)</p>
              {index.buyLowTargets.map((entry, i) => (
                <div key={i} className="border border-border rounded-md px-4 py-3">
                  <p className="text-xs text-blue-300 font-medium mb-1">
                    {entry.player}
                    {entry.currentTeam && <span className="text-gray-600 font-normal"> · {entry.currentTeam}</span>}
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
          {!index.sellHigh?.length && !index.buyLowTargets?.length && (
            <p className="text-xs text-gray-500">No standout sell-high or buy-low signals this week.</p>
          )}
        </div>
      )}
    </div>
  )
}

const TIER_STYLES = {
  contender:  { label: 'Contender',      color: 'text-green-400',  bg: 'bg-green-900/20 border-green-500/20' },
  bubble:     { label: 'Playoff Bubble', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-500/20' },
  rebuilding: { label: 'Rebuilding',     color: 'text-red-400',    bg: 'bg-red-900/20 border-red-500/20' },
}

const STANDING_TREND_ARROW = {
  up:   { icon: '↑', color: 'text-green-400' },
  down: { icon: '↓', color: 'text-red-400' },
  flat: { icon: '→', color: 'text-gray-500' },
}

const WIN_RATE_GRADE_STYLES = {
  strong: 'text-green-400 bg-green-500/10 border-green-500/20',
  ok:     'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  weak:   'text-red-400 bg-red-500/10 border-red-500/20',
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
    <div className="bg-surface border border-border rounded-lg px-5 py-5">
      <p className="text-sm font-semibold text-gray-200 mb-3">Team Pulse</p>

      {/* 1. User's team position */}
      <div className="border border-border rounded-md px-4 py-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {tierStyle && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${tierStyle.bg} ${tierStyle.color}`}>
              {tierStyle.label}
            </span>
          )}
          {trendArrow && <span className={`text-sm font-mono ${trendArrow.color}`}>{trendArrow.icon}</span>}
          <span className="text-xs text-gray-200 font-medium">{userTeam.teamName} · #{userTeam.rank ?? '?'}</span>
          <span className="text-[11px] font-mono text-gray-500">
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
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${grade ? WIN_RATE_GRADE_STYLES[grade] : 'text-gray-600 bg-gray-800 border-border'}`}
              >
                {cat.label} {wr?.rate != null ? `${Math.round(wr.rate * 100)}%` : '—'}
              </span>
            )
          })}
        </div>

        {!pulse && !pulseLoading && (
          <button
            onClick={handleGetInsight}
            className="text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors"
          >
            Get Beane's Take
          </button>
        )}
        {pulseLoading && <p className="text-xs text-gray-500 font-mono animate-pulse">Reading the league…</p>}
        {pulseError && !pulseLoading && <p className="text-xs text-red-400 font-mono">{pulseError}</p>}
        {pulse?.myTeamTake && !pulseLoading && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400 leading-relaxed">{pulse.myTeamTake.summary}</p>
            {pulse.myTeamTake.strengths && (
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="text-green-400/80 font-medium">Strengths: </span>{pulse.myTeamTake.strengths}
              </p>
            )}
            {pulse.myTeamTake.weaknesses && (
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="text-red-400/80 font-medium">Weaknesses: </span>{pulse.myTeamTake.weaknesses}
              </p>
            )}
            {pulse.myTeamTake.recommendation && (
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="text-pick font-medium">Move or hold: </span>{pulse.myTeamTake.recommendation}
              </p>
            )}
          </div>
        )}
        {insight && !pulseLoading && <p className="text-xs text-gray-400 leading-relaxed">{insight}</p>}
      </div>

      {/* 2. League landscape */}
      <div className="mb-4">
        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2">League Landscape</p>
        <div className="space-y-1">
          {teams.map(({ team, tier, overallWinRate }) => {
            const style = TIER_STYLES[tier] ?? null
            return (
              <div
                key={team.teamKey}
                className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs px-2 py-1 rounded border ${style ? style.bg : 'border-transparent'}`}
              >
                <span className={`font-medium ${style ? style.color : 'text-gray-400'}`}>
                  #{team.rank ?? '?'} {team.teamName}{team.isUser ? ' (ME)' : ''}
                </span>
                <span className="font-mono text-gray-500 text-[11px]">
                  {team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ''}
                  {overallWinRate != null ? ` · ${Math.round(overallWinRate * 100)}% cat wins` : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Trade opportunity flags */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Trade Opportunities</p>
          {!tradeFlags && !tradeLoading && (
            <button
              onClick={handleGetTradeFlags}
              className="shrink-0 text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors"
            >
              Scan for fits
            </button>
          )}
        </div>
        {tradeLoading && <p className="text-xs text-gray-500 font-mono animate-pulse">Cross-referencing rosters…</p>}
        {tradeError && !tradeLoading && <p className="text-xs text-red-400 font-mono">{tradeError}</p>}
        {tradeFlags && !tradeLoading && (
          tradeFlags.length > 0 ? (
            <div className="space-y-1.5">
              {tradeFlags.map((flag, i) => (
                <p key={i} className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-200 font-medium">{flag.player} ({flag.team}):</span> {flag.reason}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No standout trade fits right now.</p>
          )
        )}
      </div>
    </div>
  )
}

export default function SeasonHub() {
  const router = useRouter()
  const league = useLeagueStore((s) => s.getActiveLeague())
  const { setLeagueRosters } = useLeagueStore()
  const yahoo = useYahooAuth()
  const [mounted, setMounted] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const autoSyncAttempted = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  const canSync = Boolean(league?.config.yahooLeagueKey)
  const rosters = league?.leagueRosters ?? null

  async function handleSync() {
    if (!league?.config.yahooLeagueKey) return
    setSyncing(true)
    setSyncError(null)
    try {
      const sport = league.config.sport ?? 'nba'
      const res = await fetch(`/api/yahoo/sync-rosters?leagueKey=${encodeURIComponent(league.config.yahooLeagueKey)}&sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setLeagueRosters(league.id, data)
    } catch (err) {
      setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const isArchived = league?.status === 'complete'

  useEffect(() => {
    if (!mounted || !canSync || !yahoo.connected || autoSyncAttempted.current || isArchived) return
    if (isSyncStale(rosters?.syncedAt)) {
      autoSyncAttempted.current = true
      handleSync()
    }
  }, [mounted, yahoo.connected, canSync, isArchived])

  if (!mounted) return null

  if (!league) {
    return (
      <div className="min-h-screen bg-bg text-gray-200 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No active league. <button onClick={() => router.push('/')} className="text-pick hover:underline">Go home →</button></p>
      </div>
    )
  }

  if (isArchived) {
    return (
      <>
        <Head>
          <title>{league.config.name || 'Season Hub'} — PocketBeane</title>
        </Head>
        <main className="min-h-screen bg-bg text-gray-200">
          <div className="max-w-3xl mx-auto px-8 py-12">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {league.config.name || 'Season Hub'}
              </h1>
              <button
                onClick={() => router.push('/')}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ← Home
              </button>
            </div>
            <div className="bg-surface border border-border rounded-lg px-5 py-6">
              <p className="text-sm font-semibold text-gray-300 mb-1.5">Season complete</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                This league is archived, so the season advisors (waiver wire, matchup, start/sit) aren't
                shown here — they run against live rosters, and an archived league's roster snapshot is
                frozen from whenever it was archived. To keep managing this league, unarchive it from the
                home page first.
              </p>
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
      <main className="min-h-screen bg-bg text-gray-200">
        <div className="max-w-3xl mx-auto px-8 py-12">

          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {league.config.name || 'Season Hub'}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {league.config.numTeams} teams · {league.config.scoringFormat?.toUpperCase() ?? '9CAT'}
                {league.config.yahooLeagueName && (
                  <span className="ml-2 text-gray-600">· {league.config.yahooLeagueName}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Home
            </button>
          </div>

          <p className="text-xs text-blue-400 font-mono mb-8">Season Mode</p>

          {/* Sync status */}
          {canSync ? (
            <div className="flex items-center gap-2 mb-10 text-xs font-mono">
              {syncing ? (
                <span className="text-gray-500">Syncing rosters…</span>
              ) : rosters ? (
                <>
                  <span className="text-gray-600">
                    Synced {formatSyncedAt(rosters.syncedAt)} · {rosters.matched}/{rosters.total} matched
                  </span>
                  {yahoo.connected && (
                    <button
                      onClick={handleSync}
                      className="text-gray-600 hover:text-gray-300 transition-colors ml-1"
                    >
                      · Refresh
                    </button>
                  )}
                </>
              ) : yahoo.connected ? (
                <span className="text-gray-500">Syncing rosters…</span>
              ) : (
                <span className="text-yellow-500/70">Connect Yahoo to sync rosters</span>
              )}
              {syncError && <span className="text-red-400 ml-2">{syncError}</span>}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-5 mb-10">
              <p className="text-sm text-gray-400">
                This league isn't linked to Yahoo.{' '}
                <button onClick={() => router.push(`/setup?id=${league.id}`)} className="text-pick hover:underline">
                  Edit league settings →
                </button>
              </p>
            </div>
          )}

          {/* Active advisors — only when rosters are available */}
          {rosters ? (
            <div className="space-y-4 mb-8">
              <p className="text-xs font-mono text-gray-600 uppercase tracking-wider mb-3">Season Advisors</p>
              <WaiverPanel league={league} rosters={rosters} />
              <MatchupPanel league={league} rosters={rosters} yahooConnected={yahoo.connected} />
              <StartSitPanel league={league} rosters={rosters} />
              <TradeAnalyzerPanel league={league} rosters={rosters} />
              <TradeValueIndexPanel league={league} rosters={rosters} />
              <TeamPulsePanel league={league} rosters={rosters} />
            </div>
          ) : canSync ? (
            <div className="mb-8">
              <p className="text-xs font-mono text-gray-600 uppercase tracking-wider mb-3">Season Advisors</p>
              <div className="bg-surface border border-border rounded-lg px-5 py-5 text-xs text-gray-500">
                {yahoo.connected
                  ? 'Sync your rosters above to unlock the season advisors.'
                  : 'Connect Yahoo and sync your rosters to unlock the season advisors.'}
              </div>
            </div>
          ) : null}

          {/* Coming soon features */}
          {COMING_SOON.length > 0 && (
            <div>
              <p className="text-xs font-mono text-gray-600 uppercase tracking-wider mb-3">Coming Soon</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COMING_SOON.map((f) => (
                  <div
                    key={f.title}
                    className="bg-surface border border-border rounded-lg px-5 py-4 opacity-50"
                  >
                    <p className="text-sm font-semibold text-gray-300 mb-1">{f.title}</p>
                    <p className="text-xs text-gray-500">{f.description}</p>
                    <p className="text-xs text-gray-700 mt-3 font-mono">Coming soon</p>
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
