import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import useLeagueStore from '@/store/leagueStore'
import PhilosophyQuiz from '@/components/PhilosophyQuiz'
import ProfileOverrideScreen from '@/components/ProfileOverrideScreen'
import { Card, Button } from '@/components/ui'
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
    <Card variant="data" className="mb-4">
      <p className="text-xs text-ink-secondary mb-1 font-mono">Email Digests</p>
      <p className="text-xs text-ink-muted mb-3">
        Optional — used for waiver wire digests and draft recap emails. Season Hub works fully without one.
      </p>

      {!editing ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-primary">{savedEmail ?? 'No email set'}</p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-ink-secondary hover:text-ink-primary transition-colors"
            >
              {savedEmail ? 'Edit' : 'Add email'}
            </button>
            {savedEmail && (
              <button
                onClick={handleClear}
                className="text-xs text-ink-muted hover:text-signal-down transition-colors"
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
            className="flex-1 bg-surface-base border border-surface-line rounded px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-beane-green"
          />
          <Button variant="primary" onClick={handleSave} className="text-xs">
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setEditing(false); setDraft(savedEmail ?? ''); setError(null) }}
            className="text-xs"
          >
            Cancel
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-signal-down mt-2">{error}</p>}
      {saved && <p className="text-xs text-signal-watch mt-2">Saved.</p>}
    </Card>
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

      <main className="min-h-screen bg-surface-base text-ink-primary p-8">
        <div className="max-w-xl mx-auto">

          <div className="mb-6">
            <Link href="/" className="text-ink-secondary hover:text-ink-primary text-sm transition-colors">
              ← My Leagues
            </Link>
            <div className="mt-4 text-center">
              <h1 className="text-xl font-bold text-brass">GM Profile</h1>
              <p className="text-ink-secondary text-sm mt-0.5">
                Your draft philosophy — applied to all leagues by default.
              </p>
            </div>
          </div>

          <EmailDigestSettings />

          {!hasProfile ? (
            <Card variant="identity">
              <p className="text-ink-secondary mb-1">No GM Profile set yet.</p>
              <p className="text-ink-muted text-sm mb-5">
                Complete the 3-question quiz to personalize your recommendations.
              </p>
              <Button variant="primary" onClick={() => setRequizOpen(true)} className="text-sm">
                Set Up Profile
              </Button>
            </Card>
          ) : (
            <>
              <Card variant="data" className="space-y-4 mb-4">
                {QUIZ_QUESTIONS.map(q => {
                  const displayMap = DISPLAY_MAPS[q.id]
                  const value = profile[q.id]
                  const option = q.options.find(o => o.value === value)
                  return (
                    <div key={q.id} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-ink-secondary font-mono">{q.question}</p>
                        <p className="text-sm text-brass font-medium mt-0.5">
                          {displayMap[value] ?? value ?? '—'}
                        </p>
                        {option && (
                          <p className="text-xs text-ink-muted mt-0.5">{option.desc}</p>
                        )}
                      </div>
                    </div>
                  )
                })}

                <div className="pt-3 border-t border-surface-line flex items-center gap-3">
                  <Button variant="primary" onClick={() => setRequizOpen(true)} className="text-xs">
                    Edit Profile
                  </Button>
                  <Button variant="destructive" onClick={handleReset} className="text-xs">
                    Reset to defaults
                  </Button>
                </div>
              </Card>

              {leagues.length > 0 && (
                <Card variant="data">
                  <p className="text-xs text-ink-secondary mb-3 font-mono">League customizations</p>
                  <div className="space-y-3">
                    {leagues.map(league => {
                      const override = league.profileOverride
                      const resolved = resolveProfile(override)
                      const isOverrideLeague = overrideLeagueId === league.id

                      return (
                        <div key={league.id}>
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm text-ink-primary">{league.config.name || 'Unnamed League'}</p>
                              {override?.hasOverride ? (
                                <p className="text-xs text-signal-watch font-mono mt-0.5">
                                  Customized · {INJURY_DISPLAY[resolved?.injuryTolerance]} · {CATEGORY_DISPLAY[resolved?.categoryStrategy]} · {STRATEGY_DISPLAY[resolved?.draftStrategy]}
                                </p>
                              ) : (
                                <p className="text-xs text-ink-muted font-mono mt-0.5">Using global profile</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => setOverrideLeagueId(isOverrideLeague ? null : league.id)}
                                className="text-xs text-ink-secondary hover:text-ink-primary transition-colors"
                              >
                                {isOverrideLeague ? 'Cancel' : 'Customize'}
                              </button>
                              {override?.hasOverride && !isOverrideLeague && (
                                <button
                                  onClick={() => handleClearOverride(league.id)}
                                  className="text-xs text-ink-muted hover:text-signal-down transition-colors"
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
                </Card>
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
