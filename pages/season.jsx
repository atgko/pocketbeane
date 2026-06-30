import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import useLeagueStore from '@/store/leagueStore'
import { useYahooAuth } from '@/hooks/useYahooAuth'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

const COMING_SOON = [
  { title: 'Start / Sit Advisor', description: 'Optimal weekly lineup given schedule, matchup, recent form, and injury status.' },
  { title: 'Trade Analyzer', description: 'Input a give/receive — Claude evaluates net category impact and positional balance.' },
  { title: 'Trade Value Index', description: 'Running power ranking of roster trade value. Who to sell high, buy low, or hold.' },
  { title: 'League Pulse', description: "Weekly league-wide summary — who's dominating, who's weak, who might trade." },
]

const PRIORITY_STYLES = {
  'must-add': 'bg-green-900/40 text-green-400',
  'stream':   'bg-blue-900/40 text-blue-400',
  'speculative': 'bg-gray-800 text-gray-500',
}

function isSyncStale(syncedAt) {
  if (!syncedAt) return true
  return Date.now() - new Date(syncedAt).getTime() > SEVEN_DAYS_MS
}

function formatSyncedAt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function WaiverPanel({ league, rosters }) {
  const [advice, setAdvice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGetAdvice() {
    setLoading(true)
    setError(null)
    try {
      const sport = league.config.sport ?? 'nba'
      const res = await fetch('/api/season/waiver-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport,
          leagueRosters: rosters,
          gmProfile: {
            injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
            draftStrategy: league.config.philosophy?.strategy ?? 'beane',
          },
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
    <div className="bg-surface border border-border rounded-lg px-5 py-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-gray-200">Waiver Wire Advisor</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Recommended adds and drops based on your roster gaps and available free agents.
          </p>
        </div>
        <button
          onClick={handleGetAdvice}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {advice ? 'Refresh' : "Get Beane's Take"}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-gray-500 font-mono mt-4 animate-pulse">Analyzing your roster…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-3">
          {advice.headline && (
            <p className="text-xs text-gray-400 italic leading-relaxed">{advice.headline}</p>
          )}
          {advice.moves?.map((move, i) => (
            <div key={i} className="border border-border rounded-md px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${PRIORITY_STYLES[move.priority] ?? 'bg-gray-800 text-gray-500'}`}>
                  {move.priority ?? 'add'}
                </span>
                <span className="text-xs text-green-400 font-medium">+ {move.add}</span>
                {move.drop && (
                  <>
                    <span className="text-gray-700 text-xs">·</span>
                    <span className="text-xs text-red-400">− {move.drop}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{move.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
    <div className="bg-surface border border-border rounded-lg px-5 py-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-sm font-semibold text-gray-200">Head-to-Head Matchup Advisor</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Weekly category projections vs. your current opponent with lineup suggestions.
          </p>
        </div>
        {canRun ? (
          <button
            onClick={handleGetAdvice}
            disabled={loading}
            className="shrink-0 text-xs font-mono px-3 py-1.5 bg-pick/10 border border-pick/30 text-pick rounded hover:bg-pick/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {advice ? 'Refresh' : "Get Beane's Take"}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-yellow-500/60 font-mono">Needs Yahoo</span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-500 font-mono mt-4 animate-pulse">Pulling this week's matchup…</p>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 font-mono mt-4">{error}</p>
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-gray-500 font-mono">
            Week {advice.week} vs. {advice.opponent}
          </p>
          {advice.outlook && (
            <p className="text-xs text-gray-400 leading-relaxed italic">{advice.outlook}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {advice.winCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-green-500 uppercase tracking-wider mb-1.5">Win</p>
                <div className="flex flex-wrap gap-1">
                  {advice.winCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.loseCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-red-500 uppercase tracking-wider mb-1.5">Lose</p>
                <div className="flex flex-wrap gap-1">
                  {advice.loseCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.tossupCategories?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-yellow-500 uppercase tracking-wider mb-1.5">Tossup</p>
                <div className="flex flex-wrap gap-1">
                  {advice.tossupCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {advice.keyNote && (
            <p className="text-xs text-gray-500 border-t border-border pt-3 leading-relaxed">
              {advice.keyNote}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SeasonHub() {
  const router = useRouter()
  const league = useLeagueStore((s) => s.getActiveLeague())
  const { setLeagueRosters } = useLeagueStore()
  const yahoo = useYahooAuth()
  const [mounted, setMounted] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const autoSyncAttempted = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  const canSync = Boolean(league?.config.yahooLeagueKey)
  const rosters = league?.leagueRosters ?? null

  async function handleSync() {
    if (!league?.config.yahooLeagueKey) return
    setSyncing(true)
    setSyncError(null)
    try {
      const sport = league.config.sport ?? 'nba'
      const res = await fetch(`/api/yahoo/sync-rosters?leagueKey=${encodeURIComponent(league.config.yahooLeagueKey)}&sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setLeagueRosters(league.id, data)
    } catch (err) {
      setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (!mounted || !canSync || !yahoo.connected || autoSyncAttempted.current) return
    if (isSyncStale(rosters?.syncedAt)) {
      autoSyncAttempted.current = true
      handleSync()
    }
  }, [mounted, yahoo.connected, canSync])

  if (!mounted) return null

  if (!league) {
    return (
      <div className="min-h-screen bg-bg text-gray-200 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No active league. <button onClick={() => router.push('/')} className="text-pick hover:underline">Go home →</button></p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{league.config.name || 'Season Hub'} — PocketBeane</title>
      </Head>
      <main className="min-h-screen bg-bg text-gray-200">
        <div className="max-w-3xl mx-auto px-8 py-12">

          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {league.config.name || 'Season Hub'}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {league.config.numTeams} teams · {league.config.scoringFormat?.toUpperCase() ?? '9CAT'}
                {league.config.yahooLeagueName && (
                  <span className="ml-2 text-gray-600">· {league.config.yahooLeagueName}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Home
            </button>
          </div>

          <p className="text-xs text-blue-400 font-mono mb-8">Season Mode</p>

          {/* Sync status */}
          {canSync ? (
            <div className="flex items-center gap-2 mb-10 text-xs font-mono">
              {syncing ? (
                <span className="text-gray-500">Syncing rosters…</span>
              ) : rosters ? (
                <>
                  <span className="text-gray-600">
                    Synced {formatSyncedAt(rosters.syncedAt)} · {rosters.matched}/{rosters.total} matched
                  </span>
                  {yahoo.connected && (
                    <button
                      onClick={handleSync}
                      className="text-gray-600 hover:text-gray-300 transition-colors ml-1"
                    >
                      · Refresh
                    </button>
                  )}
                </>
              ) : yahoo.connected ? (
                <span className="text-gray-500">Syncing rosters…</span>
              ) : (
                <span className="text-yellow-500/70">Connect Yahoo to sync rosters</span>
              )}
              {syncError && <span className="text-red-400 ml-2">{syncError}</span>}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-5 mb-10">
              <p className="text-sm text-gray-400">
                This league isn't linked to Yahoo.{' '}
                <button onClick={() => router.push(`/setup?id=${league.id}`)} className="text-pick hover:underline">
                  Edit league settings →
                </button>
              </p>
            </div>
          )}

          {/* Active advisors — only when rosters are available */}
          {rosters ? (
            <div className="space-y-4 mb-8">
              <p className="text-xs font-mono text-gray-600 uppercase tracking-wider mb-3">Season Advisors</p>
              <WaiverPanel league={league} rosters={rosters} />
              <MatchupPanel league={league} rosters={rosters} yahooConnected={yahoo.connected} />
            </div>
          ) : canSync ? (
            <div className="mb-8">
              <p className="text-xs font-mono text-gray-600 uppercase tracking-wider mb-3">Season Advisors</p>
              <div className="bg-surface border border-border rounded-lg px-5 py-5 text-xs text-gray-500">
                {yahoo.connected
                  ? 'Sync your rosters above to unlock the season advisors.'
                  : 'Connect Yahoo and sync your rosters to unlock the season advisors.'}
              </div>
            </div>
          ) : null}

          {/* Coming soon features */}
          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-wider mb-3">Coming Soon</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {COMING_SOON.map((f) => (
                <div
                  key={f.title}
                  className="bg-surface border border-border rounded-lg px-5 py-4 opacity-50"
                >
                  <p className="text-sm font-semibold text-gray-300 mb-1">{f.title}</p>
                  <p className="text-xs text-gray-500">{f.description}</p>
                  <p className="text-xs text-gray-700 mt-3 font-mono">Coming soon</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
