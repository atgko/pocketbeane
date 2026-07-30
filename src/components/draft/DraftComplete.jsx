import { useState, useEffect, useMemo } from 'react'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import { getSportConfig } from '@/config/sports'
import { buildPlayerMap, computeRosterAssignment } from '@/utils/roster'
import { analyzeCategoryGaps } from '@/ai/categoryAnalysis'
import useLeagueStore from '@/store/leagueStore'
import { getSessionId } from '@/utils/session'
import { resolveProfile } from '@/utils/gmProfile'
import { Card, Badge } from '@/components/ui'

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

export default function DraftComplete({ league }) {
  const { setDraftOutlook } = useLeagueStore()
  const [recap, setRecap] = useState(league.draftOutlook ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const sport = league.config.sport ?? 'nba'
  const sportConfig = getSportConfig(sport)
  const { categories, percentageCategories } = sportConfig
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

  useEffect(() => {
    // Already cached — skip the API call
    if (league.draftOutlook) return
    if (userPicks.length > 0) generateOutlook()
  }, [])

  async function generateOutlook() {
    setLoading(true)
    setError(null)
    try {
      const userPicksWithData = userPicks.map(p => playerMap[p.playerId]).filter(Boolean)
      if (userPicksWithData.length === 0) {
        setError('No player data available for analysis.')
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
      setError(err.message)
    } finally {
      setLoading(false)
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

      {/* Main grid: roster + categories */}
      {userPicks.length > 0 && <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
        {/* Roster table */}
        <div className="bg-surface-raised rounded-lg border border-surface-line overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-line">
            <h3 className="text-xs font-mono text-ink-secondary uppercase tracking-wider">Your Roster</h3>
          </div>
          <table className="w-full text-xs">
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

        {/* Category grades */}
        <div className="bg-surface-raised rounded-lg border border-surface-line p-4">
          <h3 className="text-xs font-mono text-ink-secondary uppercase tracking-wider mb-4">Category Report</h3>
          <div className="space-y-2">
            {categoryGaps.map(gap => (
              <CategoryRow key={gap.id} gap={gap} />
            ))}
          </div>
        </div>
      </div>}

      {/* Beane's Season Outlook — only when picks are loaded */}
      {userPicks.length > 0 && <Card variant="advisor">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-beane-green" />
          <h3 className="text-xs font-mono text-beane-green-text/80 uppercase tracking-wider">Beane's Season Outlook</h3>
        </div>

        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border border-beane-green/40 border-t-beane-green rounded-full animate-spin" />
            <span className="text-xs font-mono text-ink-secondary">Beane is reviewing the tape…</span>
          </div>
        )}

        {recap && (
          <div className="space-y-4">
            {/* Strengths + Vulnerabilities */}
            {(recap.strengths?.length > 0 || recap.vulnerabilities?.length > 0) && (
              <div className="flex gap-4 flex-wrap">
                {recap.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-ink-muted mb-1.5">Strengths</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recap.strengths.map(cat => (
                        <Badge key={cat} tone="up">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {recap.vulnerabilities?.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-ink-muted mb-1.5">Vulnerabilities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recap.vulnerabilities.map(cat => (
                        <Badge key={cat} tone="down">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Narrative */}
            {recap.outlook && (
              <p className="text-sm text-ink-primary leading-relaxed">{recap.outlook}</p>
            )}

            {/* Injury risk note */}
            {recap.riskNote && (
              <div className="flex items-start gap-2 pt-1">
                <svg className="w-3 h-3 mt-0.5 shrink-0 text-signal-watch/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
                <p className="text-xs font-mono text-signal-watch leading-relaxed">{recap.riskNote}</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="space-y-2">
            <p className="text-xs text-signal-down font-mono">{error}</p>
            <button
              onClick={generateOutlook}
              className="text-xs font-mono px-3 py-1.5 rounded bg-surface-overlay border border-surface-line text-ink-secondary hover:text-ink-primary hover:border-beane-green transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </Card>}
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
    'bg-ink-muted/40'

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

function fmtStat(player, key) {
  const val = player?.prior_season?.[key]
  return val != null ? val.toFixed(1) : '—'
}

function fmtPct(player, key) {
  const val = player?.prior_season?.[key]
  return val != null ? val.toFixed(3).replace(/^0/, '') : '—'
}
