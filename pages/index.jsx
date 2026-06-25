import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import useLeagueStore from '@/store/leagueStore'
import { useYahooAuth } from '@/hooks/useYahooAuth'

const STATUS_LABEL = { drafting: 'In Draft', complete: 'Complete', season: 'Season' }
const STATUS_COLOR = { drafting: 'text-pick', complete: 'text-gray-500', season: 'text-blue-400' }

export default function Home() {
  const router = useRouter()
  const { leagues, setActiveLeague, deleteLeague, setLeagueStatus } = useLeagueStore()
  const [mounted, setMounted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [yahooToast, setYahooToast] = useState(null)
  const yahoo = useYahooAuth()

  useEffect(() => { setMounted(true) }, [])

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
    setLeagueStatus(id, 'season')
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
            <div className="space-y-3">
              {leagues.map((league) => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  yahooConnected={yahoo.connected}
                  confirmingDelete={confirmDelete === league.id}
                  onEnterDraft={() => handleEnterDraft(league.id)}
                  onEnterSeason={() => handleEnterSeason(league.id)}
                  onEdit={() => router.push(`/setup?id=${league.id}`)}
                  onDelete={() => handleDelete(league.id)}
                  onCancelDelete={() => setConfirmDelete(null)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

function LeagueCard({ league, yahooConnected, confirmingDelete, onEnterDraft, onEnterSeason, onEdit, onDelete, onCancelDelete }) {
  const { config, status, draft } = league
  const { updateLeagueConfig, setLeagueStatus, importDraft } = useLeagueStore()
  const pickCount = draft.picks.length
  const round = pickCount > 0 ? Math.ceil(pickCount / config.numTeams) : 0
  const isSeason = status === 'season'
  const draftComplete = Boolean(config.draftSynced) || status === 'complete'
  const showSeasonHub = isSeason || draftComplete

  const [picker, setPicker] = useState({ open: false, loading: false, leagues: [], error: null })
  const [syncState, setSyncState] = useState({ loading: false, error: null })

  const openPicker = async () => {
    setPicker({ open: true, loading: true, leagues: [], error: null })
    try {
      const res = await fetch('/api/yahoo/my-leagues')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load leagues')
      setPicker({ open: true, loading: false, leagues: data.leagues, error: null })
    } catch (err) {
      setPicker({ open: true, loading: false, leagues: [], error: err.message })
    }
  }

  const selectLeague = (yl) => {
    updateLeagueConfig(league.id, { yahooLeagueKey: yl.leagueKey, yahooLeagueName: yl.name })
    setPicker({ open: false, loading: false, leagues: [], error: null })
  }

  const syncDraft = async () => {
    setSyncState({ loading: true, error: null })
    try {
      const res = await fetch(`/api/yahoo/sync-draft?leagueKey=${encodeURIComponent(config.yahooLeagueKey)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
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
            {!draftComplete && pickCount > 0 && ` · R${round} P${pickCount + 1}`}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showSeasonHub ? (
            <button
              onClick={onEnterSeason}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-500 transition-colors"
            >
              Season Hub
            </button>
          ) : (
            <button
              onClick={onEnterDraft}
              className="px-4 py-1.5 bg-pick text-white rounded text-xs font-semibold hover:bg-green-500 transition-colors"
            >
              Draft Board
            </button>
          )}
          <button
            onClick={onEdit}
            className="px-3 py-1.5 border border-border text-gray-400 rounded text-xs hover:text-gray-200 hover:border-gray-400 transition-colors"
          >
            Edit
          </button>
          {showSeasonHub && (
            <button
              onClick={onEnterDraft}
              className="px-3 py-1.5 border border-border text-gray-600 rounded text-xs hover:text-gray-400 hover:border-gray-400 transition-colors"
            >
              ← Draft
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Yahoo (left) + Delete (right) */}
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
                  {config.draftSynced ? (
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
                      <p className="text-xs text-gray-500">No active NBA leagues found.</p>
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

        {/* Delete side */}
        <div className="shrink-0">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onDelete}
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
              onClick={onDelete}
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
        Add one for each draft you're running — Yahoo, ESPN, mock drafts, whatever platform you're on.
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
