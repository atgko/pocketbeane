import { useState } from 'react'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import { getWinRateGrade } from '@/utils/teamStanding'
import { AdvisorCard } from '@/components/ui'
import {
  TIER_STYLES,
  STANDING_TREND_ARROW,
  WIN_RATE_GRADE_STYLES,
  buildFallbackInsight,
  useTeamStanding,
} from './shared'

// League tab — the merged League Standing Intelligence panel: the never-shipped
// Roster Health Score (now a deterministic Contender/Bubble/Rebuilding tier +
// trend arrow, rather than a fabricated 1-10 number), the full league
// landscape, and League Pulse's trade-opportunity flags. Tier, trend, and
// category win rates are pure client-side math (useTeamStanding) — no fetch
// needed for those. The per-team Claude insight and the trade-opportunity
// flags are still real LLM calls, gated behind a button like every other
// advisor in the hub.
export default function LeagueTab({ league, rosters }) {
  const sport = league.config.sport ?? 'nba'
  const players = sport === 'mlb' ? mlbPlayers : nbaPlayers
  const { teams, userEntry, trend, sportConfig } = useTeamStanding({ league, rosters, players })

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
    <AdvisorCard>
      <p className="text-sm font-semibold text-ink-primary mb-3">League Standing Intelligence</p>

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
                <span className="text-signal-down font-medium">Weaknesses: </span>{pulse.myTeamTake.weaknesses}
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
    </AdvisorCard>
  )
}
