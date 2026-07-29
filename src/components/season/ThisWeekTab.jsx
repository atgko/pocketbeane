import { useState } from 'react'
import nbaPlayers from '@/data/players.json'
import { hasScheduleSupport, getStartSitMode } from '@/config/sports'
import { AdvisorCard, Card } from '@/components/ui'
import { TrendBadge, INJURY_LABELS, PITCHING_REC_STYLES, SLOT_CONFIG_KEYS, findPlayerByName } from './shared'

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
    <AdvisorCard>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Head-to-Head Matchup Advisor</p>
          <p className="text-xs text-ink-secondary mt-0.5">
            Weekly category projections vs. your current opponent with lineup suggestions.
          </p>
        </div>
        {canRun ? (
          <button
            onClick={handleGetAdvice}
            disabled={loading}
            className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {advice ? 'Refresh' : "Get Beane's Take"}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-signal-watch/60 font-mono">Needs Yahoo</span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Pulling this week's matchup…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-signal-down font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-ink-secondary font-mono tabular-nums">
            Week {advice.week} vs. {advice.opponent}
          </p>
          {advice.outlook && (
            <p className="text-xs text-ink-secondary leading-relaxed italic">{advice.outlook}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {advice.winCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-signal-up uppercase tracking-wider mb-1.5">Win</p>
                <div className="flex flex-wrap gap-1">
                  {advice.winCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-up/15 text-signal-up px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.loseCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-signal-down uppercase tracking-wider mb-1.5">Lose</p>
                <div className="flex flex-wrap gap-1">
                  {advice.loseCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-down/15 text-signal-down px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.tossupCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-signal-watch uppercase tracking-wider mb-1.5">Tossup</p>
                <div className="flex flex-wrap gap-1">
                  {advice.tossupCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-watch/15 text-signal-watch px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {advice.keyNote && (
            <p className="text-xs text-ink-secondary border-t border-surface-line pt-3 leading-relaxed">
              {advice.keyNote}
            </p>
          )}
        </div>
      )}
    </AdvisorCard>
  )
}

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
    <AdvisorCard>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Start / Sit Advisor</p>
          <p className="text-xs text-ink-secondary mt-0.5">
            {condensed
              ? 'Optimal lineup by games this week, injury status, and recent form.'
              : 'Optimal weekly lineup given schedule, recent form, and injury status.'}
          </p>
        </div>
        {supported ? (
          <button
            onClick={handleGetAdvice}
            disabled={loading}
            className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {advice ? 'Refresh' : "Get Beane's Take"}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-signal-watch/60 font-mono">Not available for {sport.toUpperCase()} yet</span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Setting your lineup…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-signal-down font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-3">
          {advice.week && (
            <p className="text-xs text-ink-secondary font-mono tabular-nums">
              Week of {advice.week.start} – {advice.week.end}
            </p>
          )}
          {advice.headline && (
            <p className="text-xs text-ink-secondary italic leading-relaxed">{advice.headline}</p>
          )}
          {advice.startingLineup?.length > 0 && (
            <div className="space-y-2">
              {advice.startingLineup.map((entry, i) => {
                const player = findPlayerByName(players, entry.player)
                const hurt = entry.injuryStatus && entry.injuryStatus !== 'healthy'
                return (
                  <div key={i} className="border border-surface-line rounded-md px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-overlay text-ink-secondary">
                        {entry.slot}
                      </span>
                      <span className="text-xs text-ink-primary font-medium flex items-center">
                        {entry.player}
                        <TrendBadge player={player} />
                      </span>
                      {!condensed && entry.gamesThisWeek != null && (
                        <span className="text-[10px] font-mono tabular-nums text-ink-secondary">
                          {entry.gamesThisWeek}g{entry.backToBack ? ' · B2B' : ''}
                        </span>
                      )}
                    </div>
                    {condensed ? (
                      <>
                        <p className="text-[11px] text-ink-secondary font-mono tabular-nums">
                          {entry.gamesThisWeek != null ? `${entry.gamesThisWeek}g this week${entry.backToBack ? ' · B2B' : ''}` : ''}
                          {hurt && (
                            <span className="text-signal-watch/80"> · {INJURY_LABELS[entry.injuryStatus] ?? entry.injuryStatus}</span>
                          )}
                        </p>
                        {entry.reason && <p className="text-xs text-ink-secondary">{entry.reason}</p>}
                      </>
                    ) : (
                      <p className="text-xs text-ink-secondary leading-relaxed">{entry.reason}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {advice.benchNotes?.length > 0 && (
            <div className="pt-3 border-t border-surface-line space-y-2">
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">Bench notes</p>
              {advice.benchNotes.map((note, i) => {
                const hurt = note.injuryStatus && note.injuryStatus !== 'healthy'
                return (
                  <p key={i} className="text-xs text-ink-secondary leading-relaxed">
                    <span className="text-ink-primary">{note.player}</span>
                    {hurt && <span className="text-signal-watch/80 font-mono"> [{INJURY_LABELS[note.injuryStatus] ?? note.injuryStatus}]</span>}
                    : {note.reason}
                  </p>
                )
              })}
            </div>
          )}
        </div>
      )}
    </AdvisorCard>
  )
}

// MLB's Start/Sit replacement — everyday hitters don't need a positional
// start/sit call, so this shows scheduled starts for rostered SPs with a
// simple start/stream/hold recommendation instead of a full weekly lineup.
// Deterministic (no LLM call) — stays on the plain data Card, not AdvisorCard.
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
    <Card>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Pitching Starts</p>
          <p className="text-xs text-ink-secondary mt-0.5">
            Scheduled starts this week for your rostered SPs, with a start / stream / hold call.
          </p>
        </div>
        <button
          onClick={handleCheckStarts}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {data ? 'Refresh' : 'Check Starts'}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Checking the rotation…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-signal-down font-mono mt-4">{error}</p>
      )}

      {data && !loading && (
        <div className="mt-4 space-y-3">
          {data.week && (
            <p className="text-xs text-ink-secondary font-mono tabular-nums">
              Week of {data.week.start} – {data.week.end}
            </p>
          )}
          {data.starts?.length > 0 ? (
            <div className="space-y-2">
              {data.starts.map((s, i) => {
                const hurt = s.injuryStatus && s.injuryStatus !== 'healthy'
                return (
                  <div key={i} className="border border-surface-line rounded-md px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-ink-primary font-medium">
                        {s.player} <span className="text-ink-muted font-mono">{s.team}</span>
                      </p>
                      <p className="text-[11px] text-ink-secondary font-mono tabular-nums mt-0.5">
                        Team plays {s.teamGamesThisWeek} time{s.teamGamesThisWeek === 1 ? '' : 's'} this week
                        {hurt && (
                          <span className="text-signal-watch/80">
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
            <p className="text-xs text-ink-secondary">No rostered starting pitchers found.</p>
          )}
        </div>
      )}
    </Card>
  )
}

export default function ThisWeekTab({ league, rosters, yahooConnected }) {
  return (
    <div className="space-y-4">
      <MatchupPanel league={league} rosters={rosters} yahooConnected={yahooConnected} />
      <StartSitPanel league={league} rosters={rosters} />
    </div>
  )
}
