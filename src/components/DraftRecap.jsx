import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import { getSportConfig } from '@/config/sports'
import { buildPlayerMap, computeRosterAssignment } from '@/utils/roster'
import { analyzeCategoryGaps } from '@/ai/categoryAnalysis'
import useLeagueStore from '@/store/leagueStore'
import { getSessionId } from '@/utils/session'
import { resolveProfile } from '@/utils/gmProfile'
import { classifyDraftDNA, getTopCategories, getFallbackPrediction, trackArchetypeStat } from '@/utils/draftDNA'
import DraftDNACard from '@/components/DraftDNACard'

const PLAYER_DATA = { nba: nbaPlayers, mlb: mlbPlayers }

const ROSTER_STAT_COLS = {
  nba: [
    { label: 'PTS',  cell: p => fmtStat(p, 'pts') },
    { label: 'REB',  cell: p => fmtStat(p, 'reb') },
    { label: 'AST',  cell: p => fmtStat(p, 'ast') },
    { label: 'STL',  cell: p => fmtStat(p, 'stl') },
    { label: 'BLK',  cell: p => fmtStat(p, 'blk') },
    { label: '3PM',  cell: p => fmtStat(p, 'three_pm') },
    { label: 'FG%',  cell: p => fmtPct(p, 'fg_pct') },
  ],
  mlb: [
    { label: 'R/W',     cell: p => p?.player_type === 'pitcher' ? fmtStat(p, 'w')    : fmtStat(p, 'r') },
    { label: 'HR/SV',   cell: p => p?.player_type === 'pitcher' ? fmtStat(p, 'sv')   : fmtStat(p, 'hr') },
    { label: 'RBI/K',   cell: p => p?.player_type === 'pitcher' ? fmtStat(p, 'k')    : fmtStat(p, 'rbi') },
    { label: 'SB/ERA',  cell: p => p?.player_type === 'pitcher' ? fmtStat(p, 'era')  : fmtStat(p, 'sb') },
    { label: 'AVG/WHP', cell: p => p?.player_type === 'pitcher' ? fmtStat(p, 'whip') : fmtPct(p, 'avg') },
  ],
}

export default function DraftRecap({ league }) {
  const router = useRouter()
  const { setDraftOutlook, setDraftDNA } = useLeagueStore()
  const [recap, setRecap] = useState(league.draftOutlook ?? null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [recapError, setRecapError] = useState(null)
  const [showDNACard, setShowDNACard] = useState(false)
  const [boldPrediction, setBoldPrediction] = useState(league.draftDNA?.boldPrediction ?? null)
  const [predictionLoading, setPredictionLoading] = useState(false)

  const sport = league.config.sport ?? 'nba'
  const sportConfig = getSportConfig(sport)
  const players = PLAYER_DATA[sport] ?? nbaPlayers
  const playerMap = useMemo(() => buildPlayerMap(players), [players])
  const statCols = ROSTER_STAT_COLS[sport] ?? ROSTER_STAT_COLS.nba

  const userPicks = useMemo(
    () => league.draft.picks.filter(p => p.draftedBy === 'user'),
    [league.draft.picks]
  )

  const categoryGaps = useMemo(
    () => analyzeCategoryGaps(userPicks, playerMap, sportConfig, league.rosterSlots.length),
    [userPicks, playerMap, league.rosterSlots.length]
  )

  const slots = useMemo(
    () => computeRosterAssignment(league.config, userPicks, playerMap, sportConfig),
    [userPicks, playerMap, league.config]
  )

  const archetype = useMemo(
    () => classifyDraftDNA(userPicks, playerMap, categoryGaps, league.config.numTeams, resolveProfile(league.profileOverride), sport),
    [userPicks, playerMap, categoryGaps, league.config.numTeams, league.profileOverride, sport]
  )

  const topCategories = useMemo(() => getTopCategories(categoryGaps), [categoryGaps])

  // On first view: generate season outlook and show DNA card
  useEffect(() => {
    if (userPicks.length === 0) return
    if (!league.draftOutlook) generateOutlook()
    if (!league.draftDNA?.generatedAt) {
      trackArchetypeStat(archetype.id)
      setShowDNACard(true)
      generateBoldPrediction()
    }
  }, [])

  async function generateOutlook() {
    setRecapLoading(true)
    setRecapError(null)
    try {
      const userPicksWithData = userPicks.map(p => playerMap[p.playerId]).filter(Boolean)
      if (userPicksWithData.length === 0) {
        setRecapError('No player data available for analysis.')
        return
      }
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() ?? '' },
        body: JSON.stringify({
          mode: 'complete',
          leagueConfig: {
            name: league.config.name,
            numTeams: league.config.numTeams,
            draftPosition: league.config.draftPosition,
            scoringFormat: league.config.scoringFormat,
            sport,
          },
          boardState: { userPicksWithData },
          categoryGaps,
          gmProfile: resolveProfile(league.profileOverride),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API error')
      setRecap(data)
      setDraftOutlook(league.id, data)
    } catch (err) {
      setRecapError(err.message)
    } finally {
      setRecapLoading(false)
    }
  }

  async function generateBoldPrediction() {
    setPredictionLoading(true)
    try {
      const userPicksWithData = userPicks.map(p => playerMap[p.playerId]).filter(Boolean)
      const rosterNames = userPicksWithData.map(p => p.name)
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() ?? '' },
        body: JSON.stringify({
          mode: 'bold_prediction',
          archetypeName: archetype.name,
          topCategories,
          rosterPlayers: rosterNames,
          sport,
        }),
      })
      const data = await res.json()
      const prediction = (res.ok && data.boldPrediction) ? data.boldPrediction : getFallbackPrediction(archetype.id, sport)
      setBoldPrediction(prediction)
      setDraftDNA(league.id, {
        archetypeId: archetype.id,
        boldPrediction: prediction,
        generatedAt: new Date().toISOString(),
      })
    } catch {
      const fallback = getFallbackPrediction(archetype.id, sport)
      setBoldPrediction(fallback)
      setDraftDNA(league.id, {
        archetypeId: archetype.id,
        boldPrediction: fallback,
        generatedAt: new Date().toISOString(),
      })
    } finally {
      setPredictionLoading(false)
    }
  }

  return (
    <div className="space-y-5 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Draft Complete</h1>
          <p className="text-sm font-mono text-gray-500 mt-0.5">{league.config.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-gray-600">{userPicks.length} players · {league.config.scoringFormat}</p>
          {league.config.draftType === 'auction' && (() => {
            const budget = league.config.auctionBudget ?? 200
            const spent = userPicks.reduce((sum, p) => sum + (p.price ?? 0), 0)
            const remaining = budget - spent
            return (
              <p className="text-xs font-mono text-gray-500 mt-0.5">
                <span className="text-white font-semibold">${spent}</span>
                <span className="text-gray-600"> / ${budget} spent · </span>
                <span className={remaining >= 0 ? 'text-green-400' : 'text-red-400'}>${Math.abs(remaining)} {remaining >= 0 ? 'left' : 'over'}</span>
              </p>
            )
          })()}
        </div>
      </div>

      {/* Empty state */}
      {userPicks.length === 0 && (
        <div className="bg-surface border border-border rounded-lg px-6 py-10 text-center">
          <p className="text-gray-400 text-sm mb-1">No draft data synced yet.</p>
          <p className="text-gray-600 text-xs font-mono">
            Go back to the home page and use <span className="text-gray-400">Import Picks</span> on this league to pull your draft from Yahoo.
          </p>
        </div>
      )}

      {/* Main grid: roster + category outlook */}
      {userPicks.length > 0 && (
        <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
          {/* Roster table */}
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider">Your Roster</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-gray-600 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 w-12">Slot</th>
                  <th className="text-left px-4 py-2">Player</th>
                  <th className="text-left px-4 py-2 w-16">Pos</th>
                  {statCols.map(col => (
                    <th key={col.label} className="text-right px-3 py-2 w-14">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, i) => {
                  const player = playerMap[slot.playerId]
                  const isBench = slot.type === 'BN'
                  return (
                    <tr key={i} className={`border-b border-border last:border-0 ${isBench ? 'opacity-60' : ''}`}>
                      <td className={`px-4 py-2 font-mono ${isBench ? 'text-gray-600' : 'text-gray-500'}`}>
                        {slot.type}
                      </td>
                      <td className="px-4 py-2 text-white font-medium">
                        {player?.name ?? <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-2 font-mono text-gray-400">
                        {player?.yahoo_positions?.join('/') ?? ''}
                      </td>
                      {statCols.map(col => (
                        <td key={col.label} className="text-right px-3 py-2 font-mono text-gray-300">
                          {col.cell(player)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Right column: Category bar chart + buttons */}
          <div className="space-y-3">
            <div className="bg-surface rounded-lg border border-border p-4">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">Category Report</h3>
              <div className="space-y-2">
                {categoryGaps.map(gap => (
                  <CategoryRow key={gap.id} gap={gap} />
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowDNACard(true)}
              className="w-full px-4 py-2.5 rounded-lg text-xs font-mono border border-white/10 text-gray-400 hover:border-pick/40 hover:text-white transition-colors text-center"
            >
              View your Draft DNA →
            </button>
            <button
              onClick={() => router.push('/season')}
              className="w-full px-4 py-2.5 rounded-lg text-xs font-mono border border-border text-gray-500 hover:text-gray-300 transition-colors text-center"
            >
              Go to Season Hub →
            </button>
          </div>
        </div>
      )}

      {/* Beane's Season Outlook */}
      {userPicks.length > 0 && (
        <div className="bg-surface rounded-lg border border-pick/25 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-pick" />
            <h3 className="text-xs font-mono text-pick/80 uppercase tracking-wider">Beane's Season Outlook</h3>
          </div>

          {recapLoading && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-pick/40 border-t-pick rounded-full animate-spin" />
              <span className="text-xs font-mono text-gray-500">Beane is reviewing the tape…</span>
            </div>
          )}

          {recap && (
            <div className="space-y-4">
              {(recap.strengths?.length > 0 || recap.vulnerabilities?.length > 0) && (
                <div className="flex gap-4 flex-wrap">
                  {recap.strengths?.length > 0 && (
                    <div>
                      <p className="text-xs font-mono text-gray-600 mb-1.5">Strengths</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recap.strengths.map(cat => (
                          <span key={cat} className="text-xs font-mono px-2 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {recap.vulnerabilities?.length > 0 && (
                    <div>
                      <p className="text-xs font-mono text-gray-600 mb-1.5">Vulnerabilities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recap.vulnerabilities.map(cat => (
                          <span key={cat} className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {recap.outlook && (
                <p className="text-sm text-gray-200 leading-relaxed">{recap.outlook}</p>
              )}

              {recap.riskNote && (
                <div className="flex items-start gap-2 pt-1">
                  <span className="text-yellow-500/70 text-xs mt-0.5 shrink-0">⚠</span>
                  <p className="text-xs font-mono text-yellow-400/70 leading-relaxed">{recap.riskNote}</p>
                </div>
              )}
            </div>
          )}

          {recapError && (
            <div className="space-y-2">
              <p className="text-xs text-red-400 font-mono">{recapError}</p>
              <button
                onClick={generateOutlook}
                className="text-xs font-mono px-3 py-1.5 rounded bg-white/5 border border-border text-gray-400 hover:text-white hover:border-pick transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Draft DNA card modal */}
      {showDNACard && (
        <DraftDNACard
          archetype={archetype}
          topCategories={topCategories}
          boldPrediction={boldPrediction}
          loadingPrediction={predictionLoading}
          onClose={() => setShowDNACard(false)}
        />
      )}
    </div>
  )
}

function CategoryRow({ gap }) {
  const isPct = gap.id === 'fg_pct' || gap.id === 'ft_pct'
  const isMissing = gap.grade === 'missing'
  const barPct = isMissing ? 0 : Math.min(gap.progress * 100, 130)

  const gradeColor =
    gap.grade === 'strong' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
    gap.grade === 'ok'     ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
    gap.grade === 'weak'   ? 'text-red-400 bg-red-500/10 border-red-500/20' :
    'text-gray-600 bg-white/5 border-border'

  const barColor =
    gap.grade === 'strong' ? 'bg-green-500/60' :
    gap.grade === 'ok'     ? 'bg-yellow-500/50' :
    gap.grade === 'weak'   ? 'bg-red-500/60' :
    'bg-gray-700/40'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-gray-500 w-8 shrink-0">{gap.label}</span>
      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-500 w-10 text-right tabular-nums">
        {isMissing ? '—' : isPct ? gap.current?.toFixed(3) : gap.current?.toFixed(1)}
      </span>
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded border w-14 text-center shrink-0 ${gradeColor}`}>
        {gap.grade}
      </span>
    </div>
  )
}

function fmtStat(player, key) {
  const val = player?.prior_season?.[key]
  return val != null ? val.toFixed(1) : '—'
}

function fmtPct(player, key) {
  const val = player?.prior_season?.[key]
  return val != null ? val.toFixed(3).replace(/^0/, '') : '—'
}
