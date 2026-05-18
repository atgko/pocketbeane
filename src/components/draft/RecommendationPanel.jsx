import { useState, useMemo, useRef, useEffect } from 'react'
import players from '@/data/players.json'
import { getSportConfig } from '@/config/sports'
import { buildPlayerMap } from '@/utils/roster'
import { isUserTurn } from '@/utils/snake'
import { computeBoardState } from '@/ai/boardState'
import { analyzeCategoryGaps } from '@/ai/categoryAnalysis'
import { computeScarcity, getSmartScarcityAlerts } from '@/ai/scarcity'
import { rankByFit } from '@/ai/valueCalculator'

const playerMap = buildPlayerMap(players)

export default function RecommendationPanel({ league }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Track which pick number we auto-analyzed for (prevents re-triggering on same turn)
  const [autoAnalyzedForPick, setAutoAnalyzedForPick] = useState(null)
  // Rate-limit advice requests to 1 per round during opponent turns
  const [lastAdviceRound, setLastAdviceRound] = useState(null)

  const sportConfig = getSportConfig(league.config.sport)
  const numTeams = league.config.numTeams
  const draftPosition = league.config.draftPosition
  const draftType = league.config.draftType ?? 'snake'

  const picks = league.draft.picks
  const totalPicks = picks.length
  const currentPickNum = totalPicks + 1
  const currentRound = Math.ceil(currentPickNum / numTeams)

  const isSnake = draftType === 'snake'
  const isMyTurn = isSnake ? isUserTurn(currentPickNum, draftPosition, numTeams) : true

  const { boardState, categoryGaps, scarcityAlerts, topCandidates } = useMemo(() => {
    const bs = computeBoardState(league, players)
    const gaps = analyzeCategoryGaps(bs.userPicks, playerMap, sportConfig, bs.totalRosterSlots)
    const scarcity = computeScarcity(players, bs.draftedIds, sportConfig)
    const alerts = getSmartScarcityAlerts(scarcity, bs.userPicks, playerMap)
    const ranked = rankByFit(bs.available, gaps, sportConfig, bs.currentPick)
    return { boardState: bs, categoryGaps: gaps, scarcityAlerts: alerts, topCandidates: ranked }
  }, [picks, league.rosterSlots])

  const isRosterFull = boardState.userPicksRemaining <= 0
  const canGetAdvice = !isMyTurn && !isRosterFull && currentRound !== lastAdviceRound && !loading

  // Build API payload (stable reference avoids stale closures in useEffect)
  const payloadRef = useRef(null)
  payloadRef.current = {
    leagueConfig: {
      name: league.config.name,
      numTeams,
      draftPosition,
      scoringFormat: league.config.scoringFormat,
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
  }

  async function runAnalysis(mode) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, ...payloadRef.current }),
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

  // Auto-generate on user's turn — fires once per turn (tracked by pick number)
  useEffect(() => {
    if (isMyTurn && !isRosterFull && currentPickNum !== autoAnalyzedForPick) {
      setAutoAnalyzedForPick(currentPickNum)
      runAnalysis('auto')
    }
  }, [currentPickNum, isMyTurn, isRosterFull])

  function handleAdviceClick() {
    setLastAdviceRound(currentRound)
    runAnalysis('advice')
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="bg-surface rounded-lg border border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-white tracking-tight">Beane's Corner</h2>
          {loading && <span className="text-xs font-mono text-gray-500 animate-pulse">thinking…</span>}
        </div>
        <p className="text-xs font-mono text-gray-600">
          {isRosterFull
            ? 'Draft complete — see full analysis below'
            : isMyTurn
            ? 'Auto-analyzing your pick…'
            : `Opponents picking — Round ${currentRound}`}
        </p>
        {!isMyTurn && !isRosterFull && (
          <button
            onClick={handleAdviceClick}
            disabled={!canGetAdvice || loading}
            className={`mt-3 w-full py-1.5 px-3 rounded text-xs font-mono font-semibold transition-colors ${
              canGetAdvice && !loading
                ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-border'
                : 'bg-white/3 text-gray-600 cursor-not-allowed border border-transparent'
            }`}
          >
            {loading ? 'Thinking…' : canGetAdvice ? "Get Beane's Insights" : `Used this round — available Round ${currentRound + 1}`}
          </button>
        )}
      </div>

      {/* AI result */}
      {error && (
        <div className="bg-surface rounded-lg border border-red-500/20 p-4">
          <p className="text-xs text-red-400 font-mono">{error}</p>
        </div>
      )}

      {result?.mode === 'advice' && result.briefing && (
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs font-mono text-gray-600 uppercase tracking-wider mb-2">Beane's Corner</p>
          <p className="text-sm text-gray-200 leading-relaxed italic">"{result.briefing}"</p>
        </div>
      )}

      {result?.mode === 'auto' && (
        <>
          {result.picks?.length > 0 && (
            <div className="bg-surface rounded-lg border border-border p-4">
              <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">My board</p>
              <div className="space-y-3">
                {result.picks.map((pick, i) => {
                  const player = playerMap[pick.id]
                  return (
                    <div key={pick.id} className="flex gap-3">
                      <span className="text-xs font-mono text-pick mt-0.5 w-3 shrink-0 font-bold">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-white">{pick.name}</span>
                          {player && (
                            <span className="text-xs font-mono text-gray-600">
                              {player.yahoo_positions.join('/')} · {player.adp.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{pick.reason}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {result.summary && (
            <div className="bg-surface rounded-lg border border-border p-4">
              <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">The read</p>
              <p className="text-xs text-gray-300 leading-relaxed">{result.summary}</p>
            </div>
          )}

          {result.scarcityAlerts?.length > 0 && (
            <div className="bg-surface rounded-lg border border-yellow-500/20 p-4">
              <p className="text-xs font-mono text-yellow-500/70 uppercase tracking-wider mb-2">Urgency</p>
              <ul className="space-y-1">
                {result.scarcityAlerts.map((a, i) => (
                  <li key={i} className="text-xs font-mono text-yellow-400/80 leading-relaxed">{a}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Category bars — always visible, update live */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Categories</p>
        <div className="space-y-1.5">
          {categoryGaps.map(gap => (
            <CategoryBar key={gap.id} gap={gap} />
          ))}
        </div>

      </div>
    </div>
  )
}

function CategoryBar({ gap }) {
  const isMissing = gap.grade === 'missing'
  const barPct = isMissing ? 0 : Math.min(gap.progress * 100, 130)

  const barColor =
    gap.grade === 'strong' ? 'bg-green-500/60' :
    gap.grade === 'ok'     ? 'bg-yellow-500/50' :
    gap.grade === 'weak'   ? 'bg-red-500/60' :
    'bg-gray-700/40'

  const labelColor =
    gap.grade === 'strong' ? 'text-green-400/80' :
    gap.grade === 'ok'     ? 'text-gray-400' :
    gap.grade === 'weak'   ? 'text-red-400/80' :
    'text-gray-600'

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono w-7 shrink-0 ${labelColor}`}>{gap.label}</span>
      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  )
}
