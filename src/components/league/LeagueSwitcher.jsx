import Link from 'next/link'
import { useRouter } from 'next/router'
import useLeagueStore from '@/store/leagueStore'

function pickInfo(league) {
  const total = league.draft.picks.length
  const numTeams = league.config.numTeams || 10
  return {
    pick: total + 1,
    round: Math.ceil((total + 1) / numTeams),
  }
}

export default function LeagueSwitcher() {
  const router = useRouter()
  const { leagues, activeLeagueId, setActiveLeague } = useLeagueStore()

  const handleSwitch = (id) => {
    setActiveLeague(id)
    if (router.pathname !== '/draft') router.push('/draft')
  }

  return (
    <div className="bg-surface border-b border-border flex items-stretch overflow-x-auto">
      {leagues.map((league) => {
        const { pick, round } = pickInfo(league)
        const isActive = activeLeagueId === league.id

        return (
          <button
            key={league.id}
            onClick={() => handleSwitch(league.id)}
            className={`flex items-center gap-2.5 px-5 py-3 text-sm border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              isActive
                ? 'border-pick text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="font-medium">{league.config.name || `League`}</span>
            <span className={`font-mono text-xs tabular-nums ${isActive ? 'text-gray-400' : 'text-gray-700'}`}>
              R{round} · P{pick}
            </span>
          </button>
        )
      })}

      <div className="flex-1" />

      <Link
        href="/"
        className="flex items-center px-4 text-xs text-gray-600 hover:text-gray-300 transition-colors shrink-0"
      >
        ← My Leagues
      </Link>
    </div>
  )
}
