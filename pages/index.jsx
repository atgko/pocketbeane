import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import useLeagueStore from '@/store/leagueStore'
import { useYahooAuth } from '@/hooks/useYahooAuth'

const STATUS_LABEL = { drafting: 'In Draft', complete: 'Archived', season: 'Season' }
const STATUS_COLOR = { drafting: 'text-pick', complete: 'text-gray-600', season: 'text-blue-400' }

const SPORT_ORDER = ['nba', 'mlb']
const SPORT_LABELS = { nba: 'NBA', mlb: 'MLB' }

function getLeagueYear(league) {
  if (league.config.yahooSeason) return Number(league.config.yahooSeason)
  const ts = parseInt(league.id.split('-')[1])
  return isNaN(ts) ? null : new Date(ts).getFullYear()
}

function formatSeasonYear(year, sport) {
  if (!year) return 'Unknown'
  if (sport === 'nba') return `${year - 1}–${String(year).slice(-2)}`
  return String(year)
}

export default function Home() {
  const router = useRouter()
  const { leagues, setActiveLeague, deleteLeague, setLeagueStatus, archiveLeague } = useLeagueStore()
  const [mounted, setMounted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [yahooToast, setYahooToast] = useState(null)
  const yahoo = useYahooAuth()

  useEffect(() => { setMounted(true) }, [])

  // Auto-archive season leagues inactive for 7+ days (last roster sync)
  useEffect(() => {
    if (!mounted) return
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
    for (const l of leagues) {
      if (l.status !== 'season') continue
      const syncedAt = l.leagueRosters?.syncedAt
      if (!syncedAt) continue
      if (Date.now() - new Date(syncedAt).getTime() > SEVEN_DAYS) {
        archiveLeague(l.id)
      }
    }
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const { yahoo_connected, yahoo_error } = router.query
    if (yahoo_connected) {
      setYahooToast({ type: 'success', message: 'Yahoo account connected.' })
      router.replace('/', undefined, { shallow: true })
    } else if (yahoo_error) {
      setYahooToast({ type: 'error', message: `Yahoo error: ${yahoo_error}` })
      router.replace('/', undefined, { shallow: true })
    }
  }, [mounted, router.query])

  if (!mounted) return null

  const handleEnterDraft = (id) => {
    setActiveLeague(id)
    router.push('/draft')
  }

  const handleEnterSeason = (id) => {
    setActiveLeague(id)
    // Only auto-promote into 'season' status from an earlier stage (e.g.
    // right after a draft syncs) — an already-archived ('complete') league
    // must stay archived just from being viewed, or every visit to a
    // concluded league's Season Hub would silently un-archive it.
    const league = leagues.find(l => l.id === id)
    if (league?.status !== 'complete') {
      setLeagueStatus(id, 'season')
    }
    router.push('/season')
  }

  const handleDelete = (id) => {
    if (confirmDelete === id) {
      deleteLeague(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
    }
  }

  // Group leagues by sport, split active vs archived within each sport
  const grouped = {}
  for (const l of leagues) {
    const sport = l.config.sport ?? 'nba'
    if (!grouped[sport]) grouped[sport] = { active: [], archived: [] }
    if (l.status === 'complete') {
      grouped[sport].archived.push(l)
    } else {
      grouped[sport].active.push(l)
    }
  }

  const sportGroups = [
    ...SPORT_ORDER.filter(s => grouped[s]),
    ...Object.keys(grouped).filter(s => !SPORT_ORDER.includes(s)),
  ].map(s => ({ sport: s, ...grouped[s] }))

  const hasMultipleSports = sportGroups.length > 1

  const sharedCardProps = {
    yahooConnected: yahoo.connected,
    onEnterDraft: handleEnterDraft,
    onEnterSeason: handleEnterSeason,
    onEdit: (id) => router.push(`/setup?id=${id}`),
    onDelete: handleDelete,
    onCancelDelete: () => setConfirmDelete(null),
    confirmDelete,
    archiveLeague,
    onUnarchive: (id) => setLeagueStatus(id, 'season'),
  }

  return (
    <>
      <Head>
        <title>PocketBeane</title>
        <meta name="description" content="AI-powered Assistant GM for fantasy basketball" />
      </Head>
      <main className="min-h-screen bg-bg text-gray-200">
        <div className="max-w-3xl mx-auto px-8 py-12">

          {/* Header */}
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">PocketBeane</h1>
              <p className="text-gray-500 mt-1 text-sm">AI-powered Assistant GM</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/gm-profile"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-mono"
                title="GM Profile"
              >
                GM Profile
              </Link>
              {leagues.length > 0 && (
                <Link
                  href="/setup"
                  className="px-4 py-2 bg-pick text-white rounded-lg text-sm font-semibold hover:bg-green-500 transition-colors"
                >
                  + New League
                </Link>
              )}
            </div>
          </div>

          {/* Yahoo connection */}
          <YahooConnect yahoo={yahoo} />

          {/* Toast */}
          {yahooToast && (
            <div className={`mb-6 px-4 py-3 rounded-lg text-sm flex items-center justify-between ${yahooToast.type === 'success' ? 'bg-green-900/40 border border-green-700 text-green-300' : 'bg-red-900/40 border border-red-700 text-red-300'}`}>
              <span>{yahooToast.message}</span>
              <button onClick={() => setYahooToast(null)} className="ml-4 text-gray-400 hover:text-gray-200">✕</button>
            </div>
          )}

          {/* League list */}
          {leagues.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-8">
              {sportGroups.map(({ sport, active, archived }) => (
                <div key={sport}>
                  {hasMultipleSports && (
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                        {SPORT_LABELS[sport] ?? sport.toUpperCase()}
                      </h2>
                      <div className="flex-1 border-t border-border" />
                    </div>
                  )}

                  <div className="space-y-3">
                    {active.map((league) => (
                      <LeagueCard
                        key={league.id}
                        league={league}
                        confirmingDelete={confirmDelete === league.id}
                        {...sharedCardProps}
                      />
                    ))}
                  </div>

                  {archived.length > 0 && (
                    <ArchivedSection
                      leagues={archived}
                      sport={sport}
                      confirmDelete={confirmDelete}
                      {...sharedCardProps}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

function ArchivedSection({ leagues, sport, confirmDelete, ...cardProps }) {
  const [expanded, setExpanded] = useState(false)

  // Group by season year, sorted newest first
  const byYear = {}
  for (const l of leagues) {
    const year = getLeagueYear(l) ?? 'Other'
    if (!byYear[year]) byYear[year] = []
    byYear[year].push(l)
  }
  const years = Object.keys(byYear).sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return Number(b) - Number(a)
  })

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(p => !p)}
        className="text-xs font-mono text-gray-600 hover:text-gray-400 transition-colors"
      >
        {expanded ? '↑' : '↓'} Archived ({leagues.length})
      </button>
      {expanded && (
        <div className="mt-3 space-y-5">
          {years.map(year => (
            <div key={year}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-gray-700">
                  {year === 'Other' ? 'Other' : formatSeasonYear(Number(year), sport)}
                </span>
                <div className="flex-1 border-t border-border/40" />
              </div>
              <div className="space-y-3">
                {byYear[year].map((league) => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    confirmingDelete={confirmDelete === league.id}
                    {...cardProps}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LeagueCard({ league, yahooConnected, confirmingDelete, onEnterDraft, onEnterSeason, onEdit, onDelete, onCancelDelete, archiveLeague, onUnarchive }) {
  const { config, status, draft } = league
  const { updateLeagueConfig, importDraft } = useLeagueStore()
  const pickCount = draft.picks.length
  const round = pickCount > 0 ? Math.ceil(pickCount / config.numTeams) : 0
  const isSeason = status === 'season'
  const isDrafting = status === 'drafting'
  const isArchived = status === 'complete'
  const draftComplete = Boolean(config.draftSynced) || isSeason || isArchived
  const showSeasonHub = isSeason || isArchived || draftComplete

  const [picker, setPicker] = useState({ open: false, loading: false, leagues: [], error: null })
  const [syncState, setSyncState] = useState({ loading: false, error: null })

  const openPicker = async () => {
    setPicker({ open: true, loading: true, leagues: [], error: null })
    try {
      const sport = config.sport ?? 'nba'
      const res = await fetch(`/api/yahoo/my-leagues?sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load leagues')
      setPicker({ open: true, loading: false, leagues: data.leagues, error: null })
    } catch (err) {
      setPicker({ open: true, loading: false, leagues: [], error: err.message })
    }
  }

  const selectLeague = (yl) => {
    updateLeagueConfig(league.id, {
      yahooLeagueKey: yl.leagueKey,
      yahooLeagueName: yl.name,
      ...(yl.season != null && { yahooSeason: yl.season }),
    })
    setPicker({ open: false, loading: false, leagues: [], error: null })
  }

  const syncDraft = async () => {
    setSyncState({ loading: true, error: null })
    try {
      const sport = config.sport ?? 'nba'
      const res = await fetch(`/api/yahoo/sync-draft?leagueKey=${encodeURIComponent(config.yahooLeagueKey)}&sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      if (data.isSeasonOver) {
        updateLeagueConfig(league.id, { isSeasonOver: true })
        setSyncState({ loading: false, error: null })
        return
      }
      importDraft(league.id, data.picks, data.draftPosition)
      setSyncState({ loading: false, error: null })
    } catch (err) {
      setSyncState({ loading: false, error: err.message })
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg px-5 py-4">

      {/* Main row: info + primary actions */}
      <div className="flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white truncate">{config.name || 'Unnamed League'}</span>
            <span className={`text-xs font-mono ${STATUS_COLOR[status] ?? 'text-gray-500'}`}>
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 font-mono">
            {config.numTeams} teams · Pick {config.draftPosition} · {config.scoringFormat?.toUpperCase() ?? '9CAT'}
            {isDrafting && pickCount > 0 && ` · R${round} P${pickCount + 1}`}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showSeasonHub ? (
            <button
              onClick={() => onEnterSeason(league.id)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-500 transition-colors"
            >
              Season Hub
            </button>
          ) : (
            <button
              onClick={() => onEnterDraft(league.id)}
              className="px-4 py-1.5 bg-pick text-white rounded text-xs font-semibold hover:bg-green-500 transition-colors"
            >
              Draft Board
            </button>
          )}
          <button
            onClick={() => onEdit(league.id)}
            className="px-3 py-1.5 border border-border text-gray-400 rounded text-xs hover:text-gray-200 hover:border-gray-400 transition-colors"
          >
            Edit
          </button>
          {showSeasonHub && (
            <button
              onClick={() => onEnterDraft(league.id)}
              className="px-3 py-1.5 border border-border text-gray-600 rounded text-xs hover:text-gray-400 hover:border-gray-400 transition-colors"
            >
              ← Draft
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Yahoo (left) + archive/delete (right) */}
      <div className="mt-3 pt-3 border-t border-border flex items-start justify-between gap-4">

        {/* Yahoo side */}
        <div className="flex-1 min-w-0">
          {yahooConnected && (
            config.yahooLeagueKey ? (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 font-mono">
                    Yahoo: <span className="text-gray-300">{config.yahooLeagueName ?? config.yahooLeagueKey}</span>
                  </span>
                  {config.isSeasonOver ? (
                    <span className="text-xs text-gray-600 font-mono">· Season complete</span>
                  ) : config.draftSynced ? (
                    <>
                      <span className="text-xs text-gray-600 font-mono">· Picks imported</span>
                      <button
                        onClick={syncDraft}
                        disabled={syncState.loading}
                        className="text-xs text-gray-500 hover:text-gray-200 underline underline-offset-2 transition-colors disabled:opacity-40"
                      >
                        {syncState.loading ? 'Syncing…' : 'Re-sync'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={syncDraft}
                      disabled={syncState.loading}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
                    >
                      {syncState.loading ? '· Importing…' : '· Import Picks'}
                    </button>
                  )}
                </div>
                {syncState.error && (
                  <p className="text-xs text-red-400 mt-1">{syncState.error}</p>
                )}
              </div>
            ) : (
              <div>
                <button
                  onClick={openPicker}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  + Link Yahoo league
                </button>
                {picker.open && (
                  <div className="mt-2">
                    {picker.loading && <p className="text-xs text-gray-500 font-mono">Loading leagues…</p>}
                    {picker.error && <p className="text-xs text-red-400">{picker.error}</p>}
                    {!picker.loading && !picker.error && picker.leagues.length === 0 && (
                      <p className="text-xs text-gray-500">No active leagues found.</p>
                    )}
                    {!picker.loading && picker.leagues.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1">
                        {picker.leagues.map((yl) => (
                          <button
                            key={yl.leagueKey}
                            onClick={() => selectLeague(yl)}
                            className="text-left text-xs px-3 py-2 rounded bg-bg border border-border hover:border-gray-500 hover:text-white text-gray-300 transition-colors"
                          >
                            <span className="font-medium">{yl.name}</span>
                            <span className="text-gray-500 ml-2">{yl.numTeams} teams · {yl.season}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Archive + Delete side */}
        <div className="shrink-0 flex items-center gap-3">
          {isSeason && (
            <button
              onClick={() => archiveLeague(league.id)}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Archive
            </button>
          )}
          {isArchived && (
            <button
              onClick={() => onUnarchive(league.id)}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Restore
            </button>
          )}
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDelete(league.id)}
                className="px-3 py-1 bg-injury text-white rounded text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={onCancelDelete}
                className="px-3 py-1 border border-border text-gray-400 rounded text-xs hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => onDelete(league.id)}
              className="text-xs text-gray-600 hover:text-injury transition-colors"
            >
              Delete
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

function YahooConnect({ yahoo }) {
  if (yahoo.loading) {
    return (
      <div className="mb-6 bg-surface border border-border rounded-lg px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
        <span className="text-xs text-gray-500 font-mono">Checking Yahoo connection…</span>
      </div>
    )
  }

  if (yahoo.connected) {
    return (
      <div className="mb-6 bg-surface border border-border rounded-lg px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-pick" />
          <span className="text-sm text-gray-300">
            Yahoo connected
            {yahoo.screenName && <span className="text-gray-500 ml-1">· {yahoo.screenName}</span>}
          </span>
        </div>
        <button
          onClick={yahoo.disconnect}
          className="text-xs text-gray-500 hover:text-injury transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="mb-6 bg-surface border border-border rounded-lg px-5 py-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-300 font-medium">Connect Yahoo Fantasy</p>
        <p className="text-xs text-gray-500 mt-0.5">Required for live draft sync and season management</p>
      </div>
      <a
        href="/api/auth/yahoo/login"
        className="px-4 py-2 bg-pick text-white rounded-lg text-xs font-semibold hover:bg-green-500 transition-colors shrink-0"
      >
        Connect Yahoo →
      </a>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-lg px-8 py-14 text-center">
      <p className="text-gray-400 mb-1">No leagues set up yet.</p>
      <p className="text-gray-600 text-sm mb-6">
        Add one for each Yahoo draft you're running. ESPN and other platforms are coming soon.
        PocketBeane runs alongside your live draft and tells you who to pick.
      </p>
      <Link
        href="/setup"
        className="px-5 py-2.5 bg-pick text-white rounded-lg text-sm font-semibold hover:bg-green-500 transition-colors"
      >
        Set Up a League
      </Link>
    </div>
  )
}
