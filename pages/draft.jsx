import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import useLeagueStore from '@/store/leagueStore'
import LeagueSwitcher from '@/components/league/LeagueSwitcher'
import PlayerPool from '@/components/draft/PlayerPool'
import RosterView from '@/components/draft/RosterView'
import RecommendationPanel from '@/components/draft/RecommendationPanel'
import DraftRecap from '@/components/DraftRecap'
import PhilosophyQuiz from '@/components/PhilosophyQuiz'
import ProfileNudge from '@/components/ProfileNudge'
import { getGMProfile, saveGMProfile } from '@/utils/gmProfile'
import { useSleeperLiveDraftSync } from '@/hooks/useSleeperLiveDraftSync'

export default function Draft() {
  const router = useRouter()
  const { leagues, activeLeagueId, getActiveLeague } = useLeagueStore()
  const [mounted, setMounted] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [showNudge, setShowNudge] = useState(false)

  // Called unconditionally (before the mounted/activeLeague early returns
  // below) per the rules of hooks — getActiveLeague() is a plain store
  // read, safe to call even before leagues are hydrated, and the hook
  // itself no-ops via optional chaining when league is null/not Sleeper.
  const activeLeagueForSync = getActiveLeague()
  useSleeperLiveDraftSync(activeLeagueForSync)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && leagues.length === 0) router.replace('/')
  }, [mounted, leagues.length])

  useEffect(() => {
    if (!mounted) return
    const profile = getGMProfile()
    if (!profile) {
      setQuizOpen(true)
    } else if (profile.skippedAt && !profile.completedAt) {
      setShowNudge(true)
    }
  }, [mounted])

  if (!mounted || leagues.length === 0) return null

  const activeLeague = getActiveLeague()
  if (!activeLeague) return null

  const userPickCount = activeLeague.draft.picks.filter(p => p.draftedBy === 'user').length
  const totalSlots = activeLeague.rosterSlots.length
  const isDraftComplete = activeLeague.config.draftSynced || activeLeague.status === 'complete' || (totalSlots > 0 && userPickCount >= totalSlots)

  function handleQuizComplete(answers) {
    saveGMProfile({ ...answers, completedAt: new Date().toISOString(), skippedAt: null })
    setQuizOpen(false)
    setShowNudge(false)
  }

  function handleQuizSkip() {
    saveGMProfile({ skippedAt: new Date().toISOString() })
    setQuizOpen(false)
    setShowNudge(true)
  }

  return (
    <>
      <Head>
        <title>{`${activeLeague.config.name} — PocketBeane`}</title>
      </Head>

      <div className="h-screen bg-surface-base text-ink-primary flex flex-col overflow-hidden">
        <LeagueSwitcher />

        {activeLeague.config.platform === 'sleeper' && (
          <p className="text-xs font-mono text-ink-muted text-center py-1 border-b border-surface-line/50">
            Data provided by Sleeper
          </p>
        )}

        {showNudge && !quizOpen && (
          <ProfileNudge onOpen={() => { setShowNudge(false); setQuizOpen(true) }} />
        )}

        {isDraftComplete ? (
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-6">
              <DraftRecap key={activeLeagueId} league={activeLeague} />
            </div>
          </main>
        ) : (
          // Desktop-first by design (live drafts are usually run on a second
          // screen) — density here is the feature, not something to soften.
          // overflow-x-auto is just a safety net so a phone check mid-draft
          // gets horizontal scroll instead of the player pool being silently
          // clipped and unreachable.
          <main className="flex-1 min-h-0 p-5 overflow-x-auto">
            <div className="grid grid-cols-[288px_1fr_264px] gap-5 h-full min-w-[880px]">
              <div className="h-full min-h-0">
                <RecommendationPanel key={activeLeagueId} league={activeLeague} />
              </div>
              <div className="overflow-y-auto">
                <PlayerPool key={activeLeagueId} />
              </div>
              <div className="h-full min-h-0">
                <RosterView league={activeLeague} />
              </div>
            </div>
          </main>
        )}
      </div>

      {quizOpen && (
        <PhilosophyQuiz onComplete={handleQuizComplete} onSkip={handleQuizSkip} />
      )}
    </>
  )
}
