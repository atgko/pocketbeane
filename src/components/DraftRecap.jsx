import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import nflPlayers from '@/data/nfl_players.json'
import { getSportConfig } from '@/config/sports'
import { buildPlayerMap, computeRosterAssignment } from '@/utils/roster'
import { analyzeCategoryGaps, analyzePositionalNeeds } from '@/ai/categoryAnalysis'
import useLeagueStore from '@/store/leagueStore'
import { getSessionId } from '@/utils/session'
import { resolveProfile } from '@/utils/gmProfile'
import { classifyDraftDNA, getTopCategories, getFallbackPrediction, trackArchetypeStat } from '@/utils/draftDNA'
import DraftDNACard from '@/components/DraftDNACard'
import { Card, Badge, AdvisorError } from '@/components/ui'

const PLAYER_DATA = { nba: nbaPlayers, mlb: mlbPlayers, nfl: nflPlayers }

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

  const isPointsFormat = league.config.scoringFormat === 'points'

  // Points-format leagues (Sleeper NFL) use positional roster-fit instead
  // of category grading — see documentation/BACKLOG.md NFL-01 / memory
  // project_sleeper_integration_scope. Shaped identically to
  // analyzeCategoryGaps's output so classifyDraftDNA, recommend.js, and
  // the category bars below all work unchanged.
  const categoryGaps = useMemo(
    () => isPointsFormat
      ? analyzePositionalNeeds(userPicks, playerMap, league.rosterSlots)
      : analyzeCategoryGaps(userPicks, playerMap, sportConfig, league.rosterSlots.length),
    [userPicks, playerMap, league.rosterSlots, isPointsFormat]
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
      const rosterSummaries = userPicksWithData.map(p => summarizePlayerStats(p, sport))
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() ?? '' },
        body: JSON.stringify({
          mode: 'bold_prediction',
          archetypeName: archetype.name,
          topCategories,
          rosterPlayers: rosterSummaries,
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
          <h1 className="text-xl font-bold text-ink-primary">Draft Complete</h1>
          <p className="text-sm font-mono text-ink-secondary mt-0.5">{league.config.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-ink-muted">{userPicks.length} players · {league.config.scoringFormat}</p>
          {league.config.draftType === 'auction' && (() => {
            const budget = league.config.auctionBudget ?? 200
            const spent = userPicks.reduce((sum, p) => sum + (p.price ?? 0), 0)
            const remaining = budget - spent
            return (
              <p className="text-xs font-mono text-ink-secondary mt-0.5">
                <span className="text-ink-primary font-semibold">${spent}</span>
                <span className="text-ink-muted"> / ${budget} spent · </span>
                <span className={remaining >= 0 ? 'text-signal-up' : 'text-signal-down'}>${Math.abs(remaining)} {remaining >= 0 ? 'left' : 'over'}</span>
              </p>
            )
          })()}
        </div>
      </div>

      {/* Empty state */}
      {userPicks.length === 0 && (
        <div className="bg-surface-raised border border-surface-line rounded-lg px-6 py-10 text-center">
          <p className="text-ink-secondary text-sm mb-1">No draft data synced yet.</p>
          <p className="text-ink-muted text-xs font-mono">
            Go back to the home page and use <span className="text-ink-secondary">Import Picks</span> on this league to pull your draft from Yahoo.
          </p>
        </div>
      )}

      {/* Main grid: roster + category outlook */}
      {userPicks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
          {/* Roster table — dense (7 stat columns), scrolls horizontally on
              narrow screens rather than clipping data invisibly */}
          <div className="bg-surface-raised rounded-lg border border-surface-line overflow-x-auto">
            <div className="px-4 py-3 border-b border-surface-line">
              <h3 className="text-xs font-mono text-ink-secondary uppercase tracking-wider">Your Roster</h3>
            </div>
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="border-b border-surface-line text-ink-muted uppercase tracking-wider">
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
                    <tr key={i} className={`border-b border-surface-line last:border-0 ${isBench ? 'opacity-60' : ''}`}>
                      <td className={`px-4 py-2 font-mono ${isBench ? 'text-ink-muted' : 'text-ink-secondary'}`}>
                        {slot.type}
                      </td>
                      <td className="px-4 py-2 text-ink-primary font-medium">
                        {player?.name ?? <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="px-4 py-2 font-mono text-ink-secondary">
                        {player?.yahoo_positions?.join('/') ?? ''}
                      </td>
                      {statCols.map(col => (
                        <td key={col.label} className="text-right px-3 py-2 font-mono text-ink-primary">
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
            <div className="bg-surface-raised rounded-lg border border-surface-line p-4">
              <h3 className="text-xs font-mono text-ink-secondary uppercase tracking-wider mb-4">Category Report</h3>
              <div className="space-y-2">
                {categoryGaps.map(gap => (
                  <CategoryRow key={gap.id} gap={gap} />
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowDNACard(true)}
              className="w-full px-4 py-2.5 rounded-lg text-xs font-mono border border-surface-line text-ink-secondary hover:border-beane-green/40 hover:text-ink-primary transition-colors text-center"
            >
              View your Draft DNA →
            </button>
            <button
              onClick={() => router.push('/season')}
              className="w-full px-4 py-2.5 rounded-lg text-xs font-mono border border-surface-line text-ink-secondary hover:text-ink-primary transition-colors text-center"
            >
              Go to Season Hub →
            </button>
          </div>
        </div>
      )}

      {/* Beane's Season Outlook */}
      {userPicks.length > 0 && (
        <Card variant="advisor">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-beane-green" />
            <h3 className="text-xs font-mono text-beane-green-text uppercase tracking-wider">Beane's Season Outlook</h3>
          </div>

          {recapLoading && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-beane-green/40 border-t-beane-green rounded-full animate-spin" />
              <span className="text-xs font-mono text-ink-muted">Beane is reviewing the tape…</span>
            </div>
          )}

          {recap && (
            <div className="space-y-4">
              {(recap.strengths?.length > 0 || recap.vulnerabilities?.length > 0) && (
                <div className="flex gap-4 flex-wrap">
                  {recap.strengths?.length > 0 && (
                    <div>
                      <p className="text-xs font-mono text-ink-muted mb-1.5">Strengths</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recap.strengths.map(cat => (
                          <Badge key={cat} tone="up" className="font-mono">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {recap.vulnerabilities?.length > 0 && (
                    <div>
                      <p className="text-xs font-mono text-ink-muted mb-1.5">Vulnerabilities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recap.vulnerabilities.map(cat => (
                          <Badge key={cat} tone="down" className="font-mono">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {recap.outlook && (
                <p className="text-sm text-ink-primary leading-relaxed">{recap.outlook}</p>
              )}

              {recap.riskNote && (
                <div className="flex items-start gap-2 pt-1">
                  <svg className="text-signal-watch/70 w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                  <p className="text-xs font-mono text-signal-watch leading-relaxed">{recap.riskNote}</p>
                </div>
              )}
            </div>
          )}

          {recapError && (
            <AdvisorError message={recapError} onRetry={generateOutlook} />
          )}
        </Card>
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
    gap.grade === 'strong' ? 'text-signal-up bg-signal-up/10 border-signal-up/20' :
    gap.grade === 'ok'     ? 'text-signal-watch bg-signal-watch/10 border-signal-watch/20' :
    gap.grade === 'weak'   ? 'text-signal-down bg-signal-down/10 border-signal-down/20' :
    'text-ink-muted bg-surface-overlay border-surface-line'

  const barColor =
    gap.grade === 'strong' ? 'bg-signal-up/60' :
    gap.grade === 'ok'     ? 'bg-signal-watch/50' :
    gap.grade === 'weak'   ? 'bg-signal-down/60' :
    'bg-ink-muted/30'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-ink-secondary w-8 shrink-0">{gap.label}</span>
      <div className="flex-1 bg-surface-overlay rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
      </div>
      <span className="text-xs font-mono text-ink-secondary w-10 text-right tabular-nums">
        {isMissing ? '—' : isPct ? gap.current?.toFixed(3) : gap.current?.toFixed(1)}
      </span>
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded border w-14 text-center shrink-0 ${gradeColor}`}>
        {gap.grade}
      </span>
    </div>
  )
}

function summarizePlayerStats(player, sport) {
  const season = player.current_season ?? player.prior_season
  if (!season) return player.name

  if (sport === 'mlb') {
    return player.player_type === 'pitcher'
      ? `${player.name} (${season.era ?? '—'} ERA, ${season.so ?? season.k ?? '—'} K)`
      : `${player.name} (${season.hr ?? '—'} HR, ${season.sb ?? '—'} SB, .${String(Math.round((season.avg ?? 0) * 1000)).padStart(3, '0')} AVG)`
  }
  return `${player.name} (${season.pts ?? '—'} PTS, ${season.reb ?? '—'} REB, ${season.ast ?? '—'} AST)`
}

function fmtStat(player, key) {
  const val = player?.prior_season?.[key]
  return val != null ? val.toFixed(1) : '—'
}

function fmtPct(player, key) {
  const val = player?.prior_season?.[key]
  return val != null ? val.toFixed(3).replace(/^0/, '') : '—'
}
