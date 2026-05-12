import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import useLeagueStore, { DEFAULT_CONFIG } from '@/store/leagueStore'
import LeagueSetup from '@/components/league/LeagueSetup'

export default function Setup() {
  const router = useRouter()
  const { id: editId } = router.query
  const { createLeague, updateLeagueConfig, getLeague } = useLeagueStore()
  const [mounted, setMounted] = useState(false)
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG, name: '' })

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
