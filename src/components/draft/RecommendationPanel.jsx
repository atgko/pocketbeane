import { useState, useMemo, useRef, useEffect } from 'react'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import nflPlayers from '@/data/nfl_players.json'
import { getSportConfig } from '@/config/sports'
import { buildPlayerMap } from '@/utils/roster'
import { isUserTurn, getNextUserPickNum } from '@/utils/snake'
import { computeBoardState } from '@/ai/boardState'
import { analyzeCategoryGaps, analyzePositionalNeeds } from '@/ai/categoryAnalysis'
import { computeScarcity, getSmartScarcityAlerts, computePositionalDepth } from '@/ai/scarcity'
import { rankByFit, rankByFitPoints, computeSleepers } from '@/ai/valueCalculator'
import { getSessionId } from '@/utils/session'
import { resolveProfile } from '@/utils/gmProfile'
import { Card, Badge, AdvisorCard } from '@/components/ui'

const PLAYER_DATA = { nba: nbaPlayers, mlb: mlbPlayers, nfl: nflPlayers }

export default function RecommendationPanel({ league }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Track which pick number we auto-analyzed for (prevents re-triggering on same turn)
  const [autoAnalyzedForPick, setAutoAnalyzedForPick] = useState(null)
  // Tracks how many user picks we've already fired post-pick analysis for
  const [postPickAnalyzedForCount, setPostPickAnalyzedForCount] = useState(null)
  // Manual refresh budget — resets each draft session (component mount)
  const [refreshesUsed, setRefreshesUsed] = useState(0)
  // Bid-advice state
  const [bidSearch, setBidSearch] = useState('')
  const [bidPlayer, setBidPlayer] = useState(null)
  const [bidAmount, setBidAmount] = useState('')
  const bidSearchRef = useRef(null)
  // Elapsed-since-this-pick-became-current clock. Yahoo doesn't expose a
  // synced pick timer to us, so a countdown against an assumed duration
  // would be fabricated precision — an honest count-up is what we can
  // actually back, and it's still the "is there a clock at all" signal
  // the draft board was missing entirely.
  const pickStartRef = useRef(Date.now())
  const [elapsedSec, setElapsedSec] = useState(0)

  const sport = league.config.sport ?? 'nba'
  const sportConfig = getSportConfig(sport)
  const players = PLAYER_DATA[sport] ?? nbaPlayers
  const playerMap = useMemo(() => buildPlayerMap(players), [players])
  const numTeams = league.config.numTeams
  const draftPosition = league.config.draftPosition
  const draftType = league.config.draftType ?? 'snake'

  const picks = league.draft.picks
  const totalPicks = picks.length
  const currentPickNum = totalPicks + 1
  const currentRound = Math.ceil(currentPickNum / numTeams)

  const isSnake = draftType === 'snake'
  const isMyTurn = isSnake
    ? isUserTurn(currentPickNum, draftPosition, numTeams)
    : ((currentPickNum - 1) % numTeams) + 1 === draftPosition

  const nextPickNum = isSnake ? getNextUserPickNum(currentPickNum, draftPosition, numTeams) : null
  const picksUntilNext = nextPickNum != null ? nextPickNum - currentPickNum - 1 : 0

  const philosophy = league.config.philosophy ?? {}

  const isPointsFormat = league.config.scoringFormat === 'points'

  const { boardState, categoryGaps, scarcityAlerts, topCandidates, sleepers } = useMemo(() => {
    const bs = computeBoardState(league, players)
    // Points-format leagues (Sleeper NFL) use positional roster-fit instead
    // of category z-scoring — see BACKLOG.md NFL-01 / memory
    // project_sleeper_integration_scope. Yahoo NFL's fantasy_ppg-as-
    // single-category leagues stay on the category path unchanged.
    const gaps = isPointsFormat
      ? analyzePositionalNeeds(bs.userPicks, playerMap, league.rosterSlots)
      : analyzeCategoryGaps(bs.userPicks, playerMap, sportConfig, bs.totalRosterSlots)
    const scarcity = computeScarcity(players, bs.draftedIds, sportConfig)
    const alerts = getSmartScarcityAlerts(scarcity, bs.userPicks, playerMap, sport)
    const ranked = isPointsFormat
      ? rankByFitPoints(bs.available, gaps, sportConfig, bs.currentPick, philosophy, { numTeams, rosterSlots: league.rosterSlots })
      : rankByFit(bs.available, gaps, sportConfig, bs.currentPick, philosophy)
    const sleeperList = computeSleepers(bs.available, bs.currentPick)
    return { boardState: bs, categoryGaps: gaps, scarcityAlerts: alerts, topCandidates: ranked, sleepers: sleeperList }
  }, [picks, league.rosterSlots, league.config.philosophy, isPointsFormat])

  const userPickCount = boardState.userPicks.length
  const isRosterFull = boardState.userPicksRemaining <= 0

  const auctionBudget = league.config.auctionBudget ?? 200
  const budgetSpent = !isSnake
    ? picks.filter(p => p.draftedBy === 'user').reduce((sum, p) => sum + (p.price ?? 0), 0)
    : 0
  const budgetRemaining = auctionBudget - budgetSpent
  const slotsLeft = boardState.userPicksRemaining
  const spendableBudget = slotsLeft > 1 ? budgetRemaining - (slotsLeft - 1) : budgetRemaining
  const avgPerSlot = slotsLeft > 0 ? budgetRemaining / slotsLeft : 0

  const REFRESH_BUDGET = 5
  const refreshesLeft = REFRESH_BUDGET - refreshesUsed
  const canRefresh = !isMyTurn && !isRosterFull && !loading && refreshesLeft > 0

  // Project who will be drafted before the user's next pick (ADP order = available is pre-sorted).
  // boardState.available preserves players.json ADP order after filtering drafted players.
  const projectedGone = picksUntilNext > 0
    ? boardState.available.slice(0, picksUntilNext).map(p => `${p.name}(${p.yahoo_positions.join('/')})`)
    : []

  const positionalDepth = computePositionalDepth(
    boardState.available, picksUntilNext, numTeams,
    totalPicks, boardState.totalRosterSlots,
    league.config, sportConfig
  )

  // Build API payload (stable reference avoids stale closures in useEffect)
  const payloadRef = useRef(null)
  payloadRef.current = {
    leagueConfig: {
      name: league.config.name,
      numTeams,
      draftPosition,
      scoringFormat: league.config.scoringFormat,
      statCategories: league.config.yahooStatCategories ?? null,
      rosterPositions: league.config.yahooRosterPositions ?? null,
      sport,
    },
    boardState: {
      userPicksWithData: boardState.userPicks.map(p => playerMap[p.playerId]).filter(Boolean),
      totalPicks,
      currentRound,
      userPicksRemaining: boardState.userPicksRemaining,
    },
    categoryGaps,
    scarcityAlerts,
    topCandidates: topCandidates.slice(0, 8),
    philosophy,
    gmProfile: resolveProfile(league.profileOverride),
    snakeContext: { picksUntilNext, nextPickNum, projectedGone, positionalDepth },
    auctionContext: !isSnake ? {
      nominationNumber: totalPicks + 1,
      budgetRemaining,
      spendableBudget: Math.max(1, spendableBudget),
      avgCostPerRemainingSpot: Math.round(avgPerSlot * 10) / 10,
    } : {},
  }

  async function runAnalysis(mode, extra = {}) {
    setLoading(true)
    setError(null)
    // Deliberately NOT setResult(null) here — this is the exact moment the
    // user is under real pick-clock pressure. The prior recommendation
    // stays on screen (dimmed via `loading` in Zone 2) until the new one
    // actually lands, instead of going blank for the ~4s Claude call.
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() ?? '' },
        body: JSON.stringify({ mode, ...payloadRef.current, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API error')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleBidAdvice() {
    const amount = Number(bidAmount)
    if (!bidPlayer || amount < 1) return
    runAnalysis('bid-advice', { bidTarget: { player: bidPlayer, currentBid: amount } })
  }

  // Reset the clock every time a new pick becomes current (not on every
  // render — picks.length is the real "a pick happened" signal).
  useEffect(() => {
    pickStartRef.current = Date.now()
    setElapsedSec(0)
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - pickStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [currentPickNum])

  const bidMatches = bidSearch.trim().length > 1 && !bidPlayer
    ? players.filter(p => p.name.toLowerCase().includes(bidSearch.trim().toLowerCase())).slice(0, 5)
    : []

  // Auto-generate on user's turn — fires once per turn (tracked by pick number)
  useEffect(() => {
    if (isMyTurn && !isRosterFull && currentPickNum !== autoAnalyzedForPick) {
      setAutoAnalyzedForPick(currentPickNum)
      runAnalysis(isSnake ? 'auto' : 'nomination')
    }
  }, [currentPickNum, isMyTurn, isRosterFull])

  // Auto-generate post-pick forward view once after each user pick (during opponent turns)
  useEffect(() => {
    if (!isMyTurn && !isRosterFull && userPickCount > 0 && userPickCount !== postPickAnalyzedForCount) {
      setPostPickAnalyzedForCount(userPickCount)
      runAnalysis(isSnake ? 'post-pick' : 'auction-watching')
    }
  }, [userPickCount, isMyTurn, isRosterFull])

  function handleRefreshClick() {
    setRefreshesUsed(n => n + 1)
    runAnalysis(isSnake ? 'post-pick' : 'auction-watching')
  }

  return (
    <div className="h-full flex flex-col gap-3">

      {/* Zone 1 — header, always visible, pinned to top */}
      <AdvisorCard eyebrow="BEANE'S CORNER" className="shrink-0">
        {!isRosterFull && (
          <div className="flex items-center justify-between -mt-1 mb-1.5">
            <span className="text-data-lg font-mono tabular-nums text-ink-primary" title="Elapsed since this pick became current">
              {formatClock(elapsedSec)}
            </span>
            {loading && (
              <span className="text-xs font-mono text-ink-secondary animate-pulse">thinking…</span>
            )}
          </div>
        )}
        {loading && (
          <div className="mb-1.5">
            <ThinkingProgress />
          </div>
        )}
        <p className="text-xs font-mono text-ink-muted">
          {isRosterFull
            ? 'Draft complete — see full analysis below'
            : isMyTurn
            ? (isSnake ? 'Auto-analyzing your pick…' : 'Your nomination turn')
            : (isSnake ? `Opponents picking — Round ${currentRound}` : `Watching — Pick #${totalPicks + 1}`)}
        </p>
        {!isSnake && !isRosterFull && (
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xs font-mono tabular-nums text-ink-primary font-semibold">${budgetRemaining} left</span>
            <span className="text-xs font-mono tabular-nums text-ink-muted">
              {slotsLeft} spots · ~${Math.round(avgPerSlot)}/slot
            </span>
          </div>
        )}
        {!isMyTurn && !isRosterFull && (
          <div className="mt-3 space-y-3">
            <div>
              <button
                onClick={handleRefreshClick}
                disabled={!canRefresh}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-mono font-semibold transition-colors ${
                  canRefresh
                    ? 'text-ink-primary hover:bg-surface-overlay border border-surface-line'
                    : 'text-ink-muted cursor-not-allowed border border-transparent'
                }`}
              >
                {loading ? 'Thinking…' : refreshesLeft === 0 ? "No refreshes remaining" : isSnake ? "Get Beane's Insights" : "Get Market Read"}
              </button>
              <p className="text-xs font-mono text-ink-muted text-center mt-1.5">
                {refreshesLeft} of {REFRESH_BUDGET} refreshes left this draft
              </p>
            </div>

            {!isSnake && (
              <div className="pt-3 border-t border-surface-line/50">
                <p className="text-xs font-mono text-ink-muted mb-1.5">On the block</p>
                <div className="relative">
                  <input
                    ref={bidSearchRef}
                    type="text"
                    value={bidPlayer ? bidPlayer.name : bidSearch}
                    onChange={e => { setBidSearch(e.target.value); setBidPlayer(null) }}
                    placeholder="Search player…"
                    className="w-full bg-surface-overlay border border-surface-line rounded-lg px-2.5 py-1.5 text-xs text-ink-primary placeholder-ink-muted font-mono focus:outline-none focus:border-beane-green/50"
                  />
                  {bidMatches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-0.5 bg-surface-overlay border border-surface-line rounded-lg overflow-hidden">
                      {bidMatches.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setBidPlayer(p); setBidSearch(''); bidSearchRef.current?.blur() }}
                          className="w-full text-left px-2.5 py-1.5 text-xs font-mono text-ink-primary hover:bg-surface-line/30 transition-colors"
                        >
                          {p.name} <span className="text-ink-muted">{p.yahoo_positions.join('/')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {bidPlayer && (
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="text-ink-secondary text-xs font-mono self-center">$</span>
                    <input
                      type="number"
                      min={1}
                      value={bidAmount}
                      onChange={e => setBidAmount(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleBidAdvice() }}
                      placeholder="bid"
                      className="w-14 bg-surface-overlay border border-surface-line rounded-lg px-2 py-1 text-xs text-ink-primary font-mono text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-beane-green/50"
                    />
                    <button
                      onClick={handleBidAdvice}
                      disabled={Number(bidAmount) < 1 || loading}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs font-mono font-semibold transition-colors ${
                        Number(bidAmount) >= 1 && !loading
                          ? 'text-ink-primary hover:bg-surface-overlay border border-surface-line'
                          : 'text-ink-muted cursor-not-allowed border border-transparent'
                      }`}
                    >
                      {loading ? 'Thinking…' : 'Get ceiling'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </AdvisorCard>

      {/* Zone 2 — AI result, scrollable if content overflows. The result
          block stays mounted and dims (rather than unmounting) while a
          fresh analysis is in flight, so the answer never goes blank
          during the wait — only the placeholder-when-truly-empty and the
          error banner are gated on `loading` directly. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
        {!error && !result && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs font-mono text-ink-muted">Analysis appears on your pick</p>
          </div>
        )}

        {error && (
          <div role="alert" className="bg-surface-raised rounded-lg border border-signal-down/20 p-4">
            <p className="text-xs text-signal-down font-mono">{error}</p>
            {result && (
              <p className="text-xs text-ink-muted font-mono mt-1.5">Showing the last successful read below.</p>
            )}
          </div>
        )}

      <div className={`flex flex-col gap-3 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {result?.verdict && (
          <AdvisorCard eyebrow="THE CEILING" title="Bid Ceiling">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-data-lg font-mono tabular-nums text-ink-primary">${result.ceiling}</p>
              <Badge
                tone={result.verdict === 'buy' ? 'up' : result.verdict === 'stretch' ? 'watch' : 'down'}
                className="font-mono"
              >
                {result.verdict === 'buy' ? 'BUY' : result.verdict === 'stretch' ? 'STRETCH' : 'PASS'}
              </Badge>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">{result.reason}</p>
          </AdvisorCard>
        )}

        {result?.picks?.length > 0 && (
          <AdvisorCard
            eyebrow="THE CALL"
            title={result.mode === 'post-pick' ? 'On My Radar'
              : result.mode === 'nomination' ? 'Nomination Targets'
              : 'My Board'}
          >
            <div className="space-y-3">
              {result.picks.map((pick, i) => {
                const player = playerMap[pick.id]
                return (
                  <div key={pick.id} className="flex gap-3">
                    <span className="text-xs font-mono tabular-nums text-beane-green-text mt-0.5 w-3 shrink-0 font-bold">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-ink-primary">{pick.name}</span>
                        {player && (
                          <span className="text-xs font-mono tabular-nums text-ink-muted">
                            {player.yahoo_positions.join('/')} · {player.adp.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <PickReason reason={pick.reason} />
                    </div>
                  </div>
                )
              })}
            </div>
          </AdvisorCard>
        )}

        {result?.briefing && (
          <AdvisorCard eyebrow="THE MARKET" title="Market Read">
            <p className="text-xs text-ink-secondary leading-relaxed">{result.briefing}</p>
          </AdvisorCard>
        )}
      </div>

        {/* Sleeper Radar — deterministic (not a Claude result), so it stays
            outside the loading-dim wrapper above and never fades. */}
        {sleepers.length > 0 && !isRosterFull && (
          <div className="bg-surface-raised rounded-lg border border-signal-info/15 p-4">
            <p className="text-xs font-mono text-signal-info uppercase tracking-wider mb-3">Sleeper Radar</p>
            <div className="space-y-2.5">
              {sleepers.map(({ player, signals }) => (
                <div key={player.id} className="flex gap-3 items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-ink-primary">{player.name}</span>
                      <span className="text-xs font-mono text-ink-muted">
                        {player.yahoo_positions.join('/')}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-signal-info mt-0.5">{signals.join(' · ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zone 3 — categories, always visible, pinned to bottom */}
      <Card variant="data" className="shrink-0">
        <p className="text-xs font-mono text-ink-secondary uppercase tracking-wider mb-3">Categories</p>
        <div className="space-y-1.5">
          {categoryGaps.map(gap => (
            <CategoryBar key={gap.id} gap={gap} />
          ))}
        </div>
      </Card>

    </div>
  )
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Indeterminate progress cue for the Claude synthesis call — actual
// duration isn't known up front, so this shows "a call is in flight"
// rather than implying a measured percentage we don't have (a determinate
// fill tied to a hardcoded timer would just be fabricated precision, the
// same thing the pick clock above deliberately avoids).
function ThinkingProgress() {
  return (
    <div className="h-0.5 w-full bg-surface-overlay rounded-full overflow-hidden">
      <div className="h-full w-2/5 bg-beane-green rounded-full animate-indeterminate-slide" />
    </div>
  )
}

function PickReason({ reason }) {
  const urgencyPrefix = 'URGENCY: '
  if (reason?.startsWith(urgencyPrefix)) {
    return (
      <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
        <span className="text-signal-watch font-semibold font-mono">URGENCY: </span>
        {reason.slice(urgencyPrefix.length)}
      </p>
    )
  }
  return <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">{reason}</p>
}

function CategoryBar({ gap }) {
  const isMissing = gap.grade === 'missing'
  const barPct = isMissing ? 0 : Math.min(gap.progress * 100, 130)

  const barColor =
    gap.grade === 'strong' ? 'bg-signal-up/60' :
    gap.grade === 'ok'     ? 'bg-signal-watch/50' :
    gap.grade === 'weak'   ? 'bg-signal-down/60' :
    'bg-ink-muted/40'

  const labelColor =
    gap.grade === 'strong' ? 'text-signal-up/80' :
    gap.grade === 'ok'     ? 'text-signal-watch' :
    gap.grade === 'weak'   ? 'text-signal-down' :
    'text-ink-muted'

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono w-7 shrink-0 ${labelColor}`}>{gap.label}</span>
      <div className="flex-1 bg-surface-overlay rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  )
}
