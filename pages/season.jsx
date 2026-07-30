import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import useLeagueStore from '@/store/leagueStore'
import { useYahooAuth } from '@/hooks/useYahooAuth'
import { Card, TabBar } from '@/components/ui'
import { isSyncStale, formatSyncedAt } from '@/components/season/shared'
import SeasonRecapPanel from '@/components/season/SeasonRecapPanel'
import ThisWeekTab from '@/components/season/ThisWeekTab'
import WaiversTab from '@/components/season/WaiversTab'
import TradesTab from '@/components/season/TradesTab'
import LeagueTab from '@/components/season/LeagueTab'
import MyTeamTab from '@/components/season/MyTeamTab'

// Roster Health Score's 1-10 number was never built past this placeholder —
// it's now the Contender/Bubble/Rebuilding tier inside the League tab instead.
const COMING_SOON = []

const TABS = [
  { key: 'this-week', label: 'This Week' },
  { key: 'waivers', label: 'Waivers' },
  { key: 'trades', label: 'Trades' },
  { key: 'league', label: 'League' },
  { key: 'my-team', label: 'My Team' },
]

const TAB_COMPONENTS = {
  'this-week': ThisWeekTab,
  waivers: WaiversTab,
  trades: TradesTab,
  league: LeagueTab,
  'my-team': MyTeamTab,
}

export default function SeasonHub() {
  const router = useRouter()
  const league = useLeagueStore((s) => s.getActiveLeague())
  const { setLeagueRosters, updateLeagueConfig } = useLeagueStore()
  const yahoo = useYahooAuth()
  const [mounted, setMounted] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [activeTab, setActiveTab] = useState('this-week')
  const autoSyncAttempted = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  // Deep-linkable tabs (?tab=trades) — read once on load so a shared/bookmarked
  // link can land directly on a specific tab; tab clicks don't push new URLs.
  useEffect(() => {
    const tab = router.query.tab
    if (typeof tab === 'string' && TAB_COMPONENTS[tab]) setActiveTab(tab)
  }, [router.query.tab])

  const canSync = Boolean(league?.config.yahooLeagueKey)
  const rosters = league?.leagueRosters ?? null
  // Either surface can learn the season is over first (this page's own sync,
  // or the home page's draft Re-sync hitting the same Yahoo 403) — trust
  // whichever one has already found out.
  const seasonOver = Boolean(league?.config.isSeasonOver) || Boolean(rosters?.isSeasonOver)

  async function handleSync() {
    if (!league?.config.yahooLeagueKey) return
    setSyncing(true)
    setSyncError(null)
    try {
      const sport = league.config.sport ?? 'nba'
      const res = await fetch(`/api/yahoo/sync-rosters?leagueKey=${encodeURIComponent(league.config.yahooLeagueKey)}&sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      // On a season-over detection, the response has no `teams` (the call
      // that would carry them is exactly what 403'd) — merge onto whatever
      // was last cached instead of overwriting it, so the final roster/
      // standings snapshot survives for the season recap below.
      setLeagueRosters(league.id, data.isSeasonOver ? { ...(rosters ?? {}), ...data } : data)
      if (data.isSeasonOver) updateLeagueConfig(league.id, { isSeasonOver: true })
    } catch (err) {
      setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const isArchived = league?.status === 'complete'

  useEffect(() => {
    if (!mounted || !canSync || !yahoo.connected || autoSyncAttempted.current || isArchived || seasonOver) return
    if (isSyncStale(rosters?.syncedAt)) {
      autoSyncAttempted.current = true
      handleSync()
    }
  }, [mounted, yahoo.connected, canSync, isArchived, seasonOver])

  if (!mounted) return null

  if (!league) {
    return (
      <div className="min-h-screen bg-surface-base text-ink-primary flex items-center justify-center">
        <p className="text-ink-secondary text-sm">No active league. <button onClick={() => router.push('/')} className="text-beane-green-text hover:underline">Go home →</button></p>
      </div>
    )
  }

  if (isArchived) {
    return (
      <>
        <Head>
          <title>{league.config.name || 'Season Hub'} — PocketBeane</title>
        </Head>
        <main className="min-h-screen bg-surface-base text-ink-primary">
          <div className="max-w-3xl mx-auto px-8 py-12">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-ink-primary tracking-tight">
                {league.config.name || 'Season Hub'}
              </h1>
              <button
                onClick={() => router.push('/')}
                className="text-xs text-ink-secondary hover:text-ink-primary transition-colors"
              >
                ← Home
              </button>
            </div>
            {seasonOver && <SeasonRecapPanel league={league} rosters={rosters} />}
            <div className="bg-surface-raised border border-surface-line rounded-lg px-5 py-6">
              <p className="text-sm font-semibold text-ink-primary mb-1.5">Season complete</p>
              {seasonOver ? (
                <p className="text-xs text-ink-secondary leading-relaxed">
                  This league's season has ended, so the Season Hub tools aren't available for it anymore
                  — Yahoo no longer serves any live data for it, archived or not.
                </p>
              ) : (
                <p className="text-xs text-ink-secondary leading-relaxed">
                  This league is archived, so the season advisors (waiver wire, matchup, start/sit) aren't
                  shown here — they run against live rosters, and an archived league's roster snapshot is
                  frozen from whenever it was archived. To keep managing this league, unarchive it from the
                  home page first.
                </p>
              )}
            </div>
          </div>
        </main>
      </>
    )
  }

  const ActiveTabComponent = TAB_COMPONENTS[activeTab]

  return (
    <>
      <Head>
        <title>{league.config.name || 'Season Hub'} — PocketBeane</title>
      </Head>
      <main className="min-h-screen bg-surface-base text-ink-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">

          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold text-ink-primary tracking-tight">
                {league.config.name || 'Season Hub'}
              </h1>
              <p className="text-ink-secondary text-sm mt-0.5">
                {league.config.numTeams} teams · {league.config.scoringFormat?.toUpperCase() ?? '9CAT'}
                {league.config.yahooLeagueName && (
                  <span className="ml-2 text-ink-muted">· {league.config.yahooLeagueName}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-xs text-ink-secondary hover:text-ink-primary transition-colors"
            >
              ← Home
            </button>
          </div>

          <p className="text-xs text-signal-info font-mono mb-8">Season Mode</p>

          {/* Sync status */}
          {canSync ? (
            <div className="flex items-center gap-2 mb-6 text-xs font-mono">
              {syncing ? (
                <span className="text-ink-secondary">Syncing rosters…</span>
              ) : seasonOver ? (
                <>
                  <span className="text-ink-muted tabular-nums">
                    {rosters?.syncedAt ? `Checked ${formatSyncedAt(rosters.syncedAt)} · season complete` : 'Season complete'}
                  </span>
                  {yahoo.connected && (
                    <button
                      onClick={handleSync}
                      className="text-ink-muted hover:text-ink-secondary transition-colors ml-1"
                      title="Force a re-check with Yahoo — the season won't have restarted, this is just a safety valve"
                    >
                      · Re-check
                    </button>
                  )}
                </>
              ) : rosters ? (
                <>
                  <span className="text-ink-muted tabular-nums">
                    Synced {formatSyncedAt(rosters.syncedAt)} · {rosters.matched}/{rosters.total} matched
                  </span>
                  {yahoo.connected && (
                    <button
                      onClick={handleSync}
                      className="text-ink-muted hover:text-ink-primary transition-colors ml-1"
                    >
                      · Refresh
                    </button>
                  )}
                </>
              ) : yahoo.connected ? (
                <span className="text-ink-secondary">Syncing rosters…</span>
              ) : (
                <span className="text-signal-watch">Connect Yahoo to sync rosters</span>
              )}
              {syncError && <span className="text-signal-down ml-2">{syncError}</span>}
            </div>
          ) : (
            <div className="mb-6">
              <Card>
                <p className="text-sm text-ink-secondary">
                  This league isn't linked to Yahoo.{' '}
                  <button onClick={() => router.push(`/setup?id=${league.id}`)} className="text-beane-green-text hover:underline">
                    Edit league settings →
                  </button>
                </p>
              </Card>
            </div>
          )}

          {/* Tabbed workspace — sticky under the header, horizontal scroll on mobile */}
          {seasonOver ? (
            <div>
              <SeasonRecapPanel league={league} rosters={rosters} />
              <div className="bg-surface-raised border border-surface-line rounded-lg px-5 py-6">
                <p className="text-sm font-semibold text-ink-primary mb-1.5">Season complete</p>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  The season has ended, so the Season Hub tools aren't available for this league anymore.
                  Come back once a new season starts and this league is re-synced.
                </p>
              </div>
            </div>
          ) : rosters ? (
            <>
              <TabBar
                tabs={TABS}
                active={activeTab}
                onChange={setActiveTab}
                className="sticky top-0 z-10 bg-surface-base mb-4"
              />
              <ActiveTabComponent league={league} rosters={rosters} yahooConnected={yahoo.connected} />
            </>
          ) : canSync ? (
            <Card className="text-xs text-ink-secondary">
              {yahoo.connected
                ? 'Sync your rosters above to unlock the season advisors.'
                : 'Connect Yahoo and sync your rosters to unlock the season advisors.'}
            </Card>
          ) : null}

          {/* Coming soon features */}
          {COMING_SOON.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mb-3">Coming Soon</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COMING_SOON.map((f) => (
                  <div
                    key={f.title}
                    className="bg-surface-raised border border-surface-line rounded-lg px-5 py-4 opacity-50"
                  >
                    <p className="text-sm font-semibold text-ink-primary mb-1">{f.title}</p>
                    <p className="text-xs text-ink-secondary">{f.description}</p>
                    <p className="text-xs text-ink-muted mt-3 font-mono">Coming soon</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
