import { useState } from 'react'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import { AdvisorCard, AdvisorError } from '@/components/ui'
import useLeagueStore from '@/store/leagueStore'
import { TrendBadge, PRIORITY_STYLES, findPlayerByName } from './shared'

export default function WaiversTab({ league, rosters }) {
  const { setSeasonAdvice } = useLeagueStore()
  // Seeded from the league store, not null — surviving a tab switch is the
  // whole point (see setSeasonAdvice in leagueStore.js for why).
  const [advice, setAdvice] = useState(league.seasonAdvice?.waivers ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const sport = league.config.sport ?? 'nba'
  const players = sport === 'mlb' ? mlbPlayers : nbaPlayers

  const gmProfile = {
    injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
    draftStrategy: league.config.philosophy?.strategy ?? 'beane',
  }
  const rosterConfig = { ilSlots: league.config.ilSlots, ilPlusSlots: league.config.ilPlusSlots }

  async function handleGetAdvice() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/season/waiver-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, leagueRosters: rosters, gmProfile, rosterConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Advice failed')
      setAdvice(data)
      setSeasonAdvice(league.id, 'waivers', data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdvisorCard eyebrow="THE WAIVER CALL">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="font-display text-heading font-medium text-ink-primary">Waiver Wire Advisor</h3>
          <p className="text-xs text-ink-secondary mt-0.5">
            Recommended adds and drops based on your roster gaps and available free agents.
          </p>
        </div>
        <button
          onClick={handleGetAdvice}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {advice ? 'Refresh' : "Get Beane's Take"}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Analyzing your roster…</p>
      )}

      {error && !loading && (
        <AdvisorError message={error} onRetry={handleGetAdvice} />
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-3">
          {advice.headline && (
            <p className="text-xs text-ink-secondary italic leading-relaxed">{advice.headline}</p>
          )}
          {advice.moves?.map((move, i) => {
            const addPlayer = findPlayerByName(players, move.add)
            const dropPlayer = move.drop ? findPlayerByName(players, move.drop) : null
            return (
              <div key={i} className="border border-surface-line rounded-md px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-micro font-mono px-2 py-0.5 rounded-full ${PRIORITY_STYLES[move.priority] ?? 'bg-surface-overlay text-ink-secondary'}`}>
                    {move.priority ?? 'add'}
                  </span>
                  <span className="text-xs text-signal-up font-medium flex items-center">
                    + {move.add}
                    <TrendBadge player={addPlayer} />
                  </span>
                  {move.drop && (
                    <>
                      <span className="text-ink-muted text-xs">·</span>
                      <span className="text-xs text-signal-down flex items-center">
                        − {move.drop}
                        <TrendBadge player={dropPlayer} />
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">{move.reason}</p>
              </div>
            )
          })}
        </div>
      )}
    </AdvisorCard>
  )
}
