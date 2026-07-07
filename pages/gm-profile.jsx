import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import useLeagueStore from '@/store/leagueStore'
import PhilosophyQuiz from '@/components/PhilosophyQuiz'
import ProfileOverrideScreen from '@/components/ProfileOverrideScreen'
import {
  getGMProfile, saveGMProfile, clearGMProfile, resolveProfile,
  QUIZ_QUESTIONS,
  INJURY_DISPLAY, CATEGORY_DISPLAY, STRATEGY_DISPLAY,
} from '@/utils/gmProfile'
import { getUserEmail, saveUserEmail, clearUserEmail } from '@/utils/userSettings'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function EmailDigestSettings() {
  const [savedEmail, setSavedEmail] = useState(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const existing = getUserEmail()
    setSavedEmail(existing)
    setDraft(existing ?? '')
  }, [])

  function handleSave() {
    if (!isValidEmail(draft)) {
      setError('Enter a valid email address')
      return
    }
    saveUserEmail(draft)
    setSavedEmail(draft)
    setEditing(false)
    setError(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleClear() {
    clearUserEmail()
    setSavedEmail(null)
    setDraft('')
    setEditing(false)
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-5 mb-4">
      <p className="text-xs text-gray-400 mb-1 font-mono">Email Digests</p>
      <p className="text-xs text-gray-600 mb-3">
        Optional — used for waiver wire digests and draft recap emails. Season Hub works fully without one.
      </p>

      {!editing ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-white">{savedEmail ?? 'No email set'}</p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {savedEmail ? 'Edit' : 'Add email'}
            </button>
            {savedEmail && (
              <button
                onClick={handleClear}
                className="text-xs text-gray-600 hover:text-injury transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(null) }}
            placeholder="you@example.com"
            className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-pick"
          />
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-pick text-white rounded text-xs font-semibold hover:bg-green-500 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => { setEditing(false); setDraft(savedEmail ?? ''); setError(null) }}
            className="px-3 py-2 border border-border text-gray-500 rounded text-xs hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="text-xs text-injury mt-2">{error}</p>}
      {saved && <p className="text-xs text-value mt-2">Saved.</p>}
    </div>
  )
}

const DISPLAY_MAPS = {
  injuryTolerance: INJURY_DISPLAY,
  categoryStrategy: CATEGORY_DISPLAY,
  draftStrategy: STRATEGY_DISPLAY,
}

export default function GMProfilePage() {
  const { leagues, setProfileOverride } = useLeagueStore()
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState(null)
  const [requizOpen, setRequizOpen] = useState(false)
  const [overrideLeagueId, setOverrideLeagueId] = useState(null)

  useEffect(() => {
    setMounted(true)
    setProfile(getGMProfile())
  }, [])

  if (!mounted) return null

  function handleRequizComplete(answers) {
    const updated = { ...answers, completedAt: new Date().toISOString(), skippedAt: null }
    saveGMProfile(updated)
    setProfile(getGMProfile())
    setRequizOpen(false)
  }

  function handleReset() {
    clearGMProfile()
    setProfile(null)
  }

  function handleSaveOverride(leagueId, override) {
    setProfileOverride(leagueId, override)
    setOverrideLeagueId(null)
  }

  function handleClearOverride(leagueId) {
    setProfileOverride(leagueId, { hasOverride: false, injuryTolerance: null, categoryStrategy: null, draftStrategy: null })
  }

  const hasProfile = Boolean(profile?.completedAt)

  return (
    <>
      <Head>
        <title>GM Profile — PocketBeane</title>
      </Head>

      <main className="min-h-screen bg-bg text-gray-200 p-8">
        <div className="max-w-xl mx-auto">

          <div className="mb-6">
            <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
              ← My Leagues
            </Link>
            <div className="mt-4 text-center">
              <h1 className="text-xl font-bold text-white">GM Profile</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Your draft philosophy — applied to all leagues by default.
              </p>
            </div>
          </div>

          <EmailDigestSettings />

          {!hasProfile ? (
            <div className="bg-surface border border-border rounded-lg px-6 py-8 text-center">
              <p className="text-gray-400 mb-1">No GM Profile set yet.</p>
              <p className="text-gray-600 text-sm mb-5">
                Complete the 3-question quiz to personalize your recommendations.
              </p>
              <button
                onClick={() => setRequizOpen(true)}
                className="px-5 py-2.5 bg-pick text-white rounded-lg text-sm font-semibold hover:bg-green-500 transition-colors"
              >
                Set Up Profile
              </button>
            </div>
          ) : (
            <>
              <div className="bg-surface border border-border rounded-lg p-5 space-y-4 mb-4">
                {QUIZ_QUESTIONS.map(q => {
                  const displayMap = DISPLAY_MAPS[q.id]
                  const value = profile[q.id]
                  const option = q.options.find(o => o.value === value)
                  return (
                    <div key={q.id} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-gray-500 font-mono">{q.question}</p>
                        <p className="text-sm text-white font-medium mt-0.5">
                          {displayMap[value] ?? value ?? '—'}
                        </p>
                        {option && (
                          <p className="text-xs text-gray-600 mt-0.5">{option.desc}</p>
                        )}
                      </div>
                    </div>
                  )
                })}

                <div className="pt-3 border-t border-border flex items-center gap-3">
                  <button
                    onClick={() => setRequizOpen(true)}
                    className="px-4 py-2 bg-pick text-white rounded text-xs font-semibold hover:bg-green-500 transition-colors"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 border border-border text-gray-500 rounded text-xs hover:text-injury hover:border-injury transition-colors"
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>

              {leagues.length > 0 && (
                <div className="bg-surface border border-border rounded-lg p-5">
                  <p className="text-xs text-gray-400 mb-3 font-mono">League customizations</p>
                  <div className="space-y-3">
                    {leagues.map(league => {
                      const override = league.profileOverride
                      const resolved = resolveProfile(override)
                      const isOverrideLeague = overrideLeagueId === league.id

                      return (
                        <div key={league.id}>
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm text-white">{league.config.name || 'Unnamed League'}</p>
                              {override?.hasOverride ? (
                                <p className="text-xs text-value font-mono mt-0.5">
                                  Customized · {INJURY_DISPLAY[resolved?.injuryTolerance]} · {CATEGORY_DISPLAY[resolved?.categoryStrategy]} · {STRATEGY_DISPLAY[resolved?.draftStrategy]}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-600 font-mono mt-0.5">Using global profile</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => setOverrideLeagueId(isOverrideLeague ? null : league.id)}
                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                              >
                                {isOverrideLeague ? 'Cancel' : 'Customize'}
                              </button>
                              {override?.hasOverride && !isOverrideLeague && (
                                <button
                                  onClick={() => handleClearOverride(league.id)}
                                  className="text-xs text-gray-600 hover:text-injury transition-colors"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                          {isOverrideLeague && (
                            <ProfileOverrideScreen
                              leagueName={league.config.name}
                              currentOverride={override}
                              onSave={o => handleSaveOverride(league.id, o)}
                              onCancel={() => setOverrideLeagueId(null)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {requizOpen && (
        <PhilosophyQuiz
          initialAnswers={profile ?? {}}
          onComplete={handleRequizComplete}
          onSkip={() => setRequizOpen(false)}
        />
      )}
    </>
  )
}
