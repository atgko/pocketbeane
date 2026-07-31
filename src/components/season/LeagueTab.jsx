import { useState } from 'react'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import nflPlayers from '@/data/nfl_players.json'
import { getWinRateGrade } from '@/utils/teamStanding'
import { AdvisorCard, Card, AdvisorError } from '@/components/ui'
import useLeagueStore from '@/store/leagueStore'
import {
  TIER_STYLES,
  STANDING_TREND_ARROW,
  WIN_RATE_GRADE_STYLES,
  buildFallbackInsight,
  useTeamStanding,
} from './shared'

// League tab — the merged League Standing Intelligence panel: the never-shipped
// Roster Health Score (now a deterministic Contender/Bubble/Rebuilding tier +
// trend arrow, rather than a fabricated 1-10 number) plus the full league
// landscape. Tier, trend, and category win rates are pure client-side math
// (useTeamStanding) — no fetch needed for those. The per-team Claude insight
// is still a real LLM call, gated behind a button like every other advisor
// in the hub. Trade opportunity flags used to live here too (a second,
// redundant call to trade-value-index just to read one field of a response
// the Trades tab already fetches in full) — an /organize IA audit found the
// same content living under two labels, so it moved to Trades tab as a third
// panel of TradeValueIndexPanel's existing result. See that component for it.
export default function LeagueTab({ league, rosters }) {
  const sport = league.config.sport ?? 'nba'
  const players = sport === 'mlb' ? mlbPlayers : sport === 'nfl' ? nflPlayers : nbaPlayers
  const { teams, userEntry, trend, sportConfig } = useTeamStanding({ league, rosters, players })
  const { setSeasonAdvice } = useLeagueStore()

  const [pulse, setPulse] = useState(league.seasonAdvice?.leaguePulse ?? null)
  const [pulseLoading, setPulseLoading] = useState(false)
  const [pulseError, setPulseError] = useState(null)

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
      setSeasonAdvice(league.id, 'leaguePulse', data)
    } catch (err) {
      setPulseError(err.message)
    } finally {
      setPulseLoading(false)
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
    <div className="space-y-4">

      {/* 1. Your standing — the one thing to read first. Beane's per-team
          take is a real LLM call, so this stays an Advisor card; the tier/
          trend/category chips are deterministic quick-glance summary for
          the same team, not a separate topic. */}
      <AdvisorCard eyebrow="THE SCOUTING REPORT" title="Your Standing">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {tierStyle && (
            <span className={`text-micro font-mono px-2 py-0.5 rounded-full border uppercase ${tierStyle.bg} ${tierStyle.color}`}>
              {tierStyle.label}
            </span>
          )}
          {trendArrow && <span className={`text-sm font-mono ${trendArrow.color}`}>{trendArrow.icon}</span>}
          <span className="text-xs text-ink-primary font-medium">{userTeam.teamName} · #{userTeam.rank ?? '?'}</span>
          <span className="text-micro font-mono tabular-nums text-ink-secondary">
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
                className={`text-micro font-mono tabular-nums px-1.5 py-0.5 rounded-lg border ${grade ? WIN_RATE_GRADE_STYLES[grade] : 'text-ink-muted bg-surface-overlay border-surface-line'}`}
              >
                {cat.label} {wr?.rate != null ? `${Math.round(wr.rate * 100)}%` : '—'}
              </span>
            )
          })}
        </div>

        {!pulse && !pulseLoading && (
          <button
            onClick={handleGetInsight}
            className="text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded-lg hover:bg-beane-green/20 transition-colors"
          >
            Get Beane's Take
          </button>
        )}
        {pulseLoading && <p className="text-xs text-ink-secondary font-mono animate-pulse">Reading the league…</p>}
        {pulseError && !pulseLoading && <AdvisorError message={pulseError} onRetry={handleGetInsight} />}
        {pulse?.myTeamTake && !pulseLoading && (
          <div className="space-y-1.5 pt-3 border-t border-surface-line/60 mt-3">
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
        {insight && !pulseLoading && <p className="text-xs text-ink-secondary leading-relaxed pt-3 border-t border-surface-line/60 mt-3">{insight}</p>}
      </AdvisorCard>

      {/* 2. League landscape — deterministic standings data, not a Claude
          result, so it belongs on a data card, not inside the Advisor
          card above (that was the actual One Voice Rule violation here). */}
      <Card variant="data">
        <h3 className="font-display text-heading font-medium text-ink-primary mb-3">League Landscape</h3>
        <div className="space-y-1">
          {teams.map(({ team, tier, overallWinRate }) => {
            const style = TIER_STYLES[tier] ?? null
            return (
              <div
                key={team.teamKey}
                className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs px-2 py-1 rounded-lg border ${style ? style.bg : 'border-transparent'}`}
              >
                <span className={`font-medium ${style ? style.color : 'text-ink-secondary'}`}>
                  #{team.rank ?? '?'} {team.teamName}{team.isUser ? ' (ME)' : ''}
                </span>
                <span className="font-mono tabular-nums text-ink-secondary text-micro">
                  {team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ''}
                  {overallWinRate != null ? ` · ${Math.round(overallWinRate * 100)}% cat wins` : ''}
                </span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
