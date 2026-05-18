import { useState, useEffect, useMemo } from 'react'
import players from '@/data/players.json'
import { getSportConfig } from '@/config/sports'
import { buildPlayerMap, computeRosterAssignment } from '@/utils/roster'
import { analyzeCategoryGaps } from '@/ai/categoryAnalysis'

const playerMap = buildPlayerMap(players)

export default function DraftComplete({ league }) {
  const [outlook, setOutlook] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const sportConfig = getSportConfig(league.config.sport)
  const { categories, percentageCategories } = sportConfig

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

  useEffect(() => {
    generateOutlook()
  }, [])

  async function generateOutlook() {
    setLoading(true)
    setError(null)
    try {
      const userPicksWithData = userPicks.map(p => playerMap[p.playerId]).filter(Boolean)
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API error')
      setOutlook(data.outlook)
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
          <h1 className="text-xl font-bold text-white">Draft Complete</h1>
          <p className="text-sm font-mono text-gray-500 mt-0.5">{league.config.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-gray-600">{userPicks.length} players · {league.config.scoringFormat}</p>
        </div>
      </div>

      {/* Main grid: roster + categories */}
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

        {/* Category grades */}
        <div className="bg-surface rounded-lg border border-border p-4">
          <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">Category Report</h3>
          <div className="space-y-2">
            {categoryGaps.map(gap => (
              <CategoryRow key={gap.id} gap={gap} />
            ))}
          </div>
        </div>
      </div>

      {/* Beane's Season Outlook */}
      <div className="bg-surface rounded-lg border border-pick/25 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-pick" />
          <h3 className="text-xs font-mono text-pick/80 uppercase tracking-wider">Beane's Season Outlook</h3>
        </div>

        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border border-pick/40 border-t-pick rounded-full animate-spin" />
            <span className="text-xs font-mono text-gray-500">Beane is reviewing the tape…</span>
          </div>
        )}

        {outlook && (
          <p className="text-sm text-gray-200 leading-relaxed">{outlook}</p>
        )}

        {error && (
          <div className="space-y-2">
            <p className="text-xs text-red-400 font-mono">{error}</p>
            <button
              onClick={generateOutlook}
              className="text-xs font-mono px-3 py-1.5 rounded bg-white/5 border border-border text-gray-400 hover:text-white hover:border-pick transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
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
