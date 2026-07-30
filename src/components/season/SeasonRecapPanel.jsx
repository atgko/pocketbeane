import { useState, useEffect, useRef } from 'react'
import useLeagueStore from '@/store/leagueStore'
import { AdvisorError } from '@/components/ui'
import { TROPHY_BY_RANK } from './shared'

// One-time end-of-season recap: fires exactly once per league (guarded by
// `league.seasonRecap` already being set, and an in-flight ref so a fast
// re-render can't double-fire), built from whatever roster/standings
// snapshot was last cached before Yahoo locked the league down — there's no
// live pull possible once a season's over, so this is as final as it gets.
export default function SeasonRecapPanel({ league, rosters }) {
  const { setSeasonRecap } = useLeagueStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const attempted = useRef(false)
  const recap = league.seasonRecap
  const hasFinalRoster = Boolean(rosters?.teams?.length)

  async function fetchRecap() {
    setLoading(true)
    setError(null)
    try {
      const sport = league.config.sport ?? 'nba'
      const res = await fetch('/api/season/season-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport,
          leagueRosters: rosters,
          gmProfile: {
            injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
            draftStrategy: league.config.philosophy?.draftStrategy,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't put together your season recap.")
      setSeasonRecap(league.id, data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (recap || !hasFinalRoster || attempted.current) return
    attempted.current = true
    fetchRecap()
  }, [recap, hasFinalRoster])

  if (!hasFinalRoster) return null

  return (
    <div className="bg-surface-raised border border-surface-line rounded-lg px-5 py-6 mb-6">
      {loading && !recap && (
        <p className="text-xs text-ink-secondary font-mono animate-pulse">Putting together your season recap…</p>
      )}
      {error && !recap && !loading && (
        <AdvisorError message={error} onRetry={fetchRecap} />
      )}
      {recap && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {TROPHY_BY_RANK[recap.rank] && (
              <span className="text-4xl leading-none">{TROPHY_BY_RANK[recap.rank]}</span>
            )}
            <div>
              <h3 className="font-display text-heading font-medium text-ink-primary">
                Finished #{recap.rank ?? '?'} of {recap.numTeams} — {recap.teamName}
              </h3>
              <p className="text-xs text-ink-secondary font-mono tabular-nums">
                {recap.wins}-{recap.losses}{recap.ties ? `-${recap.ties}` : ''}
              </p>
            </div>
          </div>

          {recap.headline && <p className="text-sm text-ink-primary italic leading-relaxed">{recap.headline}</p>}
          {recap.summary && <p className="text-xs text-ink-secondary leading-relaxed">{recap.summary}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-surface-line">
            {recap.strengths && (
              <p className="text-xs text-ink-secondary leading-relaxed">
                <span className="text-signal-up font-mono">What worked — </span>{recap.strengths}
              </p>
            )}
            {recap.weaknesses && (
              <p className="text-xs text-ink-secondary leading-relaxed">
                <span className="text-signal-down font-mono">What held you back — </span>{recap.weaknesses}
              </p>
            )}
          </div>

          {recap.lookAhead && (
            <p className="text-xs text-ink-secondary leading-relaxed border-t border-surface-line pt-3">
              <span className="text-signal-info font-mono">Next season — </span>{recap.lookAhead}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
