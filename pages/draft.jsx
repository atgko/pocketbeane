import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import useLeagueStore from '@/store/leagueStore'
import LeagueSwitcher from '@/components/league/LeagueSwitcher'
import PlayerPool from '@/components/draft/PlayerPool'

export default function Draft() {
  const router = useRouter()
  const { leagues, activeLeagueId, getActiveLeague } = useLeagueStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && leagues.length === 0) {
      router.replace('/')
    }
  }, [mounted, leagues.length])

  if (!mounted || leagues.length === 0) return null

  const activeLeague = getActiveLeague()

  return (
    <>
      <Head>
        <title>
          {activeLeague ? `${activeLeague.config.name} — PocketBeane` : 'Draft Board — PocketBeane'}
        </title>
      </Head>
      <div className="min-h-screen bg-bg text-gray-200 flex flex-col">
        <LeagueSwitcher />
        <main className="flex-1 max-w-7xl mx-auto w-full p-6">
          <PlayerPool key={activeLeagueId} />
        </main>
      </div>
    </>
  )
}
