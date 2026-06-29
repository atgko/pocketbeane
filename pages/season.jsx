import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import useLeagueStore from '@/store/leagueStore'
import { useYahooAuth } from '@/hooks/useYahooAuth'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

const COMING_SOON = [
  { title: 'Head-to-Head Matchup Advisor', description: 'Weekly category projections vs. your current opponent with lineup suggestions.' },
  { title: 'Waiver Wire Advisor', description: 'Recommended adds and drops based on roster gaps, schedule density, and recent trends.' },
  { title: 'Trade Analyzer', description: 'Input a give/receive — Claude evaluates net category impact and positional balance.' },
  { title: 'Trade Value Index', description: 'Running power ranking of roster trade value. Who to sell high, buy low, or hold.' },
  { title: 'Start / Sit Advisor', description: 'Optimal weekly lineup given schedule, matchup, recent form, and injury status.' },
  { title: 'League Pulse', description: "Weekly league-wide summary — who's dominating, who's weak, who might trade." },
]

function isSyncStale(syncedAt) {
  if (!syncedAt) return true
  return Date.now() - new Date(syncedAt).getTime() > SEVEN_DAYS_MS
}

function formatSyncedAt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
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

          {/* Coming soon feature grid */}
          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-wider mb-3">Season Features</p>
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
