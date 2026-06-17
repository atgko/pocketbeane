import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import useLeagueStore, { DEFAULT_CONFIG } from '@/store/leagueStore'
import LeagueSetup from '@/components/league/LeagueSetup'
import { useYahooAuth } from '@/hooks/useYahooAuth'

export default function Setup() {
  const router = useRouter()
  const { id: editId } = router.query
  const { createLeague, updateLeagueConfig, getLeague } = useLeagueStore()
  const [mounted, setMounted] = useState(false)
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG, name: '' })
  const [syncState, setSyncState] = useState(null) // null | 'loading' | 'success' | 'error'
  const [syncError, setSyncError] = useState(null)
  const yahoo = useYahooAuth()

  useEffect(() => { setMounted(true) }, [])

  // Seed form when editing an existing league
  useEffect(() => {
    if (mounted && editId) {
      const league = getLeague(editId)
      if (league) setConfig({ ...DEFAULT_CONFIG, ...league.config })
    }
  }, [mounted, editId])

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

  const handleYahooSync = async () => {
    if (!config.yahooLeagueKey) return
    setSyncState('loading')
    setSyncError(null)
    try {
      const res = await fetch(`/api/yahoo/settings?league_key=${encodeURIComponent(config.yahooLeagueKey)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setConfig((prev) => ({
        ...prev,
        yahooStatCategories: data.statCategories,
        yahooRosterPositions: data.rosterPositions,
        ...(data.numTeams && { numTeams: data.numTeams }),
        ...(data.leagueName && !prev.name && { name: data.leagueName }),
      }))
      setSyncState('success')
    } catch (err) {
      setSyncError(err.message)
      setSyncState('error')
    }
  }

  const handleSave = () => {
    if (editId) {
      updateLeagueConfig(editId, config)
      router.push('/')
    } else {
      createLeague(config)
      router.push('/draft')
    }
  }

  const isEditing = Boolean(editId)

  if (!mounted) return null

  return (
    <>
      <Head>
        <title>{isEditing ? 'Edit League' : 'New League'} — PocketBeane</title>
      </Head>
      <main className="min-h-screen bg-bg text-gray-200 p-8">
        <div className="max-w-xl mx-auto">
          <div className="mb-8 flex items-center gap-4">
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

          <LeagueSetup
            config={config}
            onUpdate={updateField}
            onToggleCategory={toggleCategory}
          />

          {yahoo.connected && (
            <div className="mt-4 bg-surface rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-300">Sync from Yahoo</p>
                  <p className="text-xs text-gray-600 mt-0.5 font-mono">
                    Pull real stat categories and roster slots into the AI prompt.
                  </p>
                </div>
                {config.yahooStatCategories && syncState !== 'success' && (
                  <span className="text-xs font-mono text-green-400/70">
                    ✓ {config.yahooStatCategories.length} cats synced
                  </span>
                )}
                {syncState === 'success' && (
                  <span className="text-xs font-mono text-green-400/70">
                    ✓ Synced — {config.yahooStatCategories?.length} cats · {config.numTeams} teams
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.yahooLeagueKey ?? ''}
                  onChange={(e) => updateField('yahooLeagueKey', e.target.value)}
                  placeholder="Yahoo league key, e.g. 466.l.22207"
                  className="flex-1 bg-bg border border-border rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-pick placeholder:text-gray-700"
                />
                <button
                  onClick={handleYahooSync}
                  disabled={!config.yahooLeagueKey || syncState === 'loading'}
                  className="px-4 py-1.5 bg-white/5 border border-border text-gray-300 rounded text-xs font-mono hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {syncState === 'loading' ? 'Syncing…' : 'Sync'}
                </button>
              </div>
              {syncState === 'error' && (
                <p className="text-xs text-red-400 font-mono">{syncError}</p>
              )}
            </div>
          )}

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
