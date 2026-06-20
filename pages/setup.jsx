import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useCallback } from 'react'
import useLeagueStore, { DEFAULT_CONFIG } from '@/store/leagueStore'
import LeagueSetup from '@/components/league/LeagueSetup'
import { useYahooAuth } from '@/hooks/useYahooAuth'

export default function Setup() {
  const router = useRouter()
  const { id: editId } = router.query
  const { createLeague, updateLeagueConfig, getLeague, importDraft, setActiveLeague } = useLeagueStore()
  const [mounted, setMounted] = useState(false)
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG, name: '' })
  const [syncState, setSyncState] = useState(null) // null | 'loading' | 'success' | 'error'
  const [syncError, setSyncError] = useState(null)
  const [yahooLeagues, setYahooLeagues] = useState([])
  const [leaguesLoading, setLeaguesLoading] = useState(false)
  const yahoo = useYahooAuth()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && editId) {
      const league = getLeague(editId)
      if (league) {
        setConfig({ ...DEFAULT_CONFIG, ...league.config })
        if (league.config.yahooStatCategories) setSyncState('success')
      }
    }
  }, [mounted, editId])

  useEffect(() => {
    if (!mounted || !yahoo.connected) return
    setLeaguesLoading(true)
    fetch('/api/yahoo/my-leagues')
      .then(r => r.json())
      .then(d => { setYahooLeagues(d.leagues ?? []); setLeaguesLoading(false) })
      .catch(() => setLeaguesLoading(false))
  }, [mounted, yahoo.connected])

  const updateField = (field, value) =>
    setConfig((prev) => ({ ...prev, [field]: value }))

  const toggleCategory = (catId) =>
    setConfig((prev) => {
      const cats = prev.categories
      return {
        ...prev,
        categories: cats.includes(catId)
          ? cats.filter((c) => c !== catId)
          : [...cats, catId],
      }
    })

  const handleLeagueSelect = useCallback(async (leagueKey, leagueName) => {
    if (!leagueKey) return
    setSyncState('loading')
    setSyncError(null)
    try {
      const res = await fetch(`/api/yahoo/settings?league_key=${encodeURIComponent(leagueKey)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      const ilCount = data.rosterPositions?.find(p => p.position === 'IL')?.count ?? null
      const ilPlusCount = data.rosterPositions?.find(p => p.position === 'IL+')?.count ?? null

      setConfig(prev => ({
        ...prev,
        yahooLeagueKey: leagueKey,
        yahooLeagueName: leagueName ?? data.leagueName ?? null,
        yahooStatCategories: data.statCategories,
        yahooRosterPositions: data.rosterPositions,
        ...(data.numTeams && { numTeams: data.numTeams }),
        ...(data.leagueName && !prev.name && { name: data.leagueName }),
        ...(data.draftType && { draftType: data.draftType }),
        ...(data.auctionBudget != null && { auctionBudget: data.auctionBudget }),
        ...(ilCount !== null && { ilSlots: ilCount }),
        ...(ilPlusCount !== null && { ilPlusSlots: ilPlusCount }),
      }))
      setSyncState('success')
    } catch (err) {
      setSyncError(err.message)
      setSyncState('error')
    }
  }, [])

  const handleSave = async () => {
    if (editId) {
      updateLeagueConfig(editId, config)
      router.push('/')
      return
    }

    const leagueId = createLeague(config)
    setActiveLeague(leagueId)

    if (config.yahooLeagueKey) {
      try {
        const res = await fetch(`/api/yahoo/sync-draft?leagueKey=${encodeURIComponent(config.yahooLeagueKey)}`)
        const data = await res.json()
        if (res.ok && data.total > 0) {
          importDraft(leagueId, data.picks, data.draftPosition)
          router.push('/season')
          return
        }
      } catch {
        // Draft sync failed — fall through to draft board
      }
    }

    router.push('/draft')
  }

  const isEditing = Boolean(editId)
  const isYahooSynced = syncState === 'success' || Boolean(config.yahooStatCategories)

  if (!mounted) return null

  return (
    <>
      <Head>
        <title>{isEditing ? 'Edit League' : 'New League'} — PocketBeane</title>
      </Head>
      <main className="min-h-screen bg-bg text-gray-200 p-8">
        <div className="max-w-xl mx-auto">

          {/* Header */}
          <div className="mb-6 flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">
                {isEditing ? 'Edit League' : 'New League'}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {isEditing
                  ? 'Changes save back to the home page.'
                  : 'Set up a new draft — regular season, mock draft, whatever.'}
              </p>
            </div>
          </div>

          {/* League Name */}
          <div className="bg-surface rounded-lg border border-border px-5 py-4 mb-4">
            <label className="block text-xs text-gray-400 mb-1.5">League Name</label>
            <input
              type="text"
              value={config.name}
              onChange={e => updateField('name', e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-pick"
              placeholder="e.g. Main League, Mock Draft #1"
            />
          </div>

          {/* Yahoo Sync */}
          {yahoo.connected && (
            <div className="mb-4 bg-surface rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-300">Sync from Yahoo</p>
                  <p className="text-xs text-gray-600 mt-0.5 font-mono">
                    Pulls real stat categories, roster slots, and league settings.
                  </p>
                </div>
                {isYahooSynced && (
                  <span className="text-xs font-mono text-green-400/70 shrink-0 ml-4">
                    ✓ {config.yahooStatCategories?.length} cats · {config.numTeams} teams
                  </span>
                )}
              </div>

              {leaguesLoading ? (
                <p className="text-xs text-gray-500 font-mono">Loading leagues…</p>
              ) : yahooLeagues.length > 0 ? (
                <select
                  value={config.yahooLeagueKey ?? ''}
                  onChange={e => {
                    const league = yahooLeagues.find(l => l.leagueKey === e.target.value)
                    if (league) handleLeagueSelect(league.leagueKey, league.name)
                  }}
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-pick"
                >
                  <option value="">Select a Yahoo league…</option>
                  {yahooLeagues.map(l => (
                    <option key={l.leagueKey} value={l.leagueKey}>
                      {l.name} ({l.numTeams} teams · {l.season})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.yahooLeagueKey ?? ''}
                    onChange={e => updateField('yahooLeagueKey', e.target.value)}
                    placeholder="Yahoo league key, e.g. 466.l.22207"
                    className="flex-1 bg-bg border border-border rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-pick placeholder:text-gray-700"
                  />
                  <button
                    onClick={() => handleLeagueSelect(config.yahooLeagueKey, null)}
                    disabled={!config.yahooLeagueKey || syncState === 'loading'}
                    className="px-4 py-1.5 bg-white/5 border border-border text-gray-300 rounded text-xs font-mono hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {syncState === 'loading' ? 'Syncing…' : 'Sync'}
                  </button>
                </div>
              )}

              {syncState === 'loading' && yahooLeagues.length > 0 && (
                <p className="text-xs text-gray-500 font-mono">Syncing…</p>
              )}
              {syncState === 'error' && (
                <p className="text-xs text-red-400 font-mono">{syncError}</p>
              )}
            </div>
          )}

          {/* Strategy + Composition */}
          <LeagueSetup
            config={config}
            onUpdate={updateField}
            onToggleCategory={toggleCategory}
            isYahooSynced={isYahooSynced}
          />

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-pick text-white font-semibold rounded-lg hover:bg-green-500 transition-colors text-sm"
            >
              {isEditing ? 'Save Changes' : 'Create League & Go to Draft →'}
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2.5 border border-border text-gray-400 rounded-lg hover:text-gray-200 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
