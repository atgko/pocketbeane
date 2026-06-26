import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import players from '@/data/players.json'
import { getSportConfig } from '@/config/sports'
import { buildPlayerMap, computeRosterAssignment } from '@/utils/roster'
import { analyzeCategoryGaps } from '@/ai/categoryAnalysis'
import useLeagueStore from '@/store/leagueStore'
import { getSessionId } from '@/utils/session'
import { resolveProfile } from '@/utils/gmProfile'
import { classifyDraftDNA, getTopCategories, FALLBACK_PREDICTIONS } from '@/utils/draftDNA'
import CategoryOutlook from '@/components/CategoryOutlook'
import DraftDNACard from '@/components/DraftDNACard'

const playerMap = buildPlayerMap(players)

export default function DraftRecap({ league }) {
  const router = useRouter()
  const { setDraftOutlook, setDraftDNA } = useLeagueStore()
  const [recap, setRecap] = useState(league.draftOutlook ?? null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [recapError, setRecapError] = useState(null)
  const [showDNACard, setShowDNACard] = useState(false)
  const [boldPrediction, setBoldPrediction] = useState(league.draftDNA?.boldPrediction ?? null)
  const [predictionLoading, setPredictionLoading] = useState(false)

  const sportConfig = getSportConfig(league.config.sport)

  const userPicks = useMemo(
    () => league.draft.picks.filter(p => p.draftedBy === 'user'),
    [league.draft.picks]
  )

  const categoryGaps = useMemo(
    () => analyzeCategoryGaps(userPicks, playerMap, sportConfig, league.rosterSlots.length),
    [userPicks, league.rosterSlots.length]
  )

  const slots = useMemo(
    () => computeRosterAssignment(league.config, userPicks, playerMap, sportConfig),
    [userPicks, league.config]
  )

  const archetype = useMemo(
    () => classifyDraftDNA(userPicks, playerMap, categoryGaps, league.config.numTeams, resolveProfile(league.profileOverride)),
    [userPicks, categoryGaps, league.config.numTeams, league.profileOverride]
  )

  const topCategories = useMemo(() => getTopCategories(categoryGaps), [categoryGaps])

  // On first view: generate season outlook and show DNA card
  useEffect(() => {
    if (userPicks.length === 0) return
    if (!league.draftOutlook) generateOutlook()
    if (!league.draftDNA?.generatedAt) {
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
        }),
      })
      const data = await res.json()
      const prediction = (res.ok && data.boldPrediction) ? data.boldPrediction : FALLBACK_PREDICTIONS[archetype.id]
      setBoldPrediction(prediction)
      setDraftDNA(league.id, {
        archetypeId: archetype.id,
        boldPrediction: prediction,
        generatedAt: new Date().toISOString(),
      })
    } catch {
      const fallback = FALLBACK_PREDICTIONS[archetype.id]
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
                  <th className="text-right px-3 py-2 w-12">PTS</th>
                  <th className="text-right px-3 py-2 w-12">REB</th>
                  <th className="text-right px-3 py-2 w-12">AST</th>
                  <th className="text-right px-3 py-2 w-12">STL</th>
                  <th className="text-right px-3 py-2 w-12">BLK</th>
                  <th className="text-right px-3 py-2 w-14">3PM</th>
                  <th className="text-right px-3 py-2 w-14">FG%</th>
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
                      <td className="text-right px-3 py-2 font-mono text-gray-300">{fmtStat(player, 'pts')}</td>
                      <td className="text-right px-3 py-2 font-mono text-gray-300">{fmtStat(player, 'reb')}</td>
                      <td className="text-right px-3 py-2 font-mono text-gray-300">{fmtStat(player, 'ast')}</td>
                      <td className="text-right px-3 py-2 font-mono text-gray-300">{fmtStat(player, 'stl')}</td>
                      <td className="text-right px-3 py-2 font-mono text-gray-300">{fmtStat(player, 'blk')}</td>
                      <td className="text-right px-3 py-2 font-mono text-gray-300">{fmtStat(player, 'three_pm')}</td>
                      <td className="text-right px-3 py-2 font-mono text-gray-300">{fmtPct(player, 'fg_pct')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Right column: Category Outlook + DNA button */}
          <div className="space-y-3">
            <CategoryOutlook categoryGaps={categoryGaps} />
            <button
              onClick={() => setShowDNACard(true)}
              className="w-full px-4 py-2.5 rounded-lg text-xs font-mono border border-white/10 text-gray-400 hover:border-pick/40 hover:text-white transition-colors text-center"
            >
              View your Draft DNA →
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

      {/* Season Management CTA */}
      {userPicks.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5 text-center">
          <p className="text-sm text-white font-semibold">Your season starts now.</p>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            Check back once the season starts for waiver wire and matchup recommendations.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-3 px-4 py-2 bg-white/5 border border-border text-gray-300 rounded text-xs font-mono hover:bg-white/10 hover:text-white transition-colors"
          >
            Back to My Leagues →
          </button>
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

function fmtStat(player, key) {
  const val = player?.prior_season?.[key]
  return val != null ? val.toFixed(1) : '—'
}

function fmtPct(player, key) {
  const val = player?.prior_season?.[key]
  return val != null ? val.toFixed(3).replace(/^0/, '') : '—'
}
