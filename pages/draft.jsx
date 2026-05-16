import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import useLeagueStore from '@/store/leagueStore'
import LeagueSwitcher from '@/components/league/LeagueSwitcher'
import PlayerPool from '@/components/draft/PlayerPool'
import RosterView from '@/components/draft/RosterView'
import RecommendationPanel from '@/components/draft/RecommendationPanel'
import DraftComplete from '@/components/draft/DraftComplete'

export default function Draft() {
  const router = useRouter()
  const { leagues, activeLeagueId, getActiveLeague } = useLeagueStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && leagues.length === 0) router.replace('/')
  }, [mounted, leagues.length])

  if (!mounted || leagues.length === 0) return null

  const activeLeague = getActiveLeague()
  if (!activeLeague) return null

  const userPickCount = activeLeague.draft.picks.filter(p => p.draftedBy === 'user').length
  const totalSlots = activeLeague.rosterSlots.length
  const isDraftComplete = totalSlots > 0 && userPickCount >= totalSlots

  return (
    <>
      <Head>
        <title>{`${activeLeague.config.name} — PocketBeane`}</title>
      </Head>

      {/* Full-viewport flex column so the content area fills exactly the remaining height */}
      <div className="h-screen bg-bg text-gray-200 flex flex-col overflow-hidden">
        <LeagueSwitcher />

        {isDraftComplete ? (
          /* Draft complete: centered scrollable area, no columns */
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-6">
              <DraftComplete key={activeLeagueId} league={activeLeague} />
            </div>
          </main>
        ) : (
          /* Live draft: 3-column, each column independently scrollable */
          <main className="flex-1 min-h-0 p-5">
            <div className="grid grid-cols-[288px_1fr_264px] gap-5 h-full">
              <div className="overflow-y-auto pb-20">
                <RecommendationPanel key={activeLeagueId} league={activeLeague} />
              </div>
              <div className="overflow-y-auto pb-20">
                <PlayerPool key={activeLeagueId} />
              </div>
              <div className="overflow-y-auto pb-20">
                <RosterView league={activeLeague} />
              </div>
            </div>
          </main>
        )}
      </div>
    </>
  )
}
