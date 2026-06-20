import Head from 'next/head'
import { useRouter } from 'next/router'
import useLeagueStore from '@/store/leagueStore'

const FEATURES = [
  {
    title: 'Head-to-Head Matchup Advisor',
    description: 'Weekly category projections vs. your current opponent with lineup suggestions.',
  },
  {
    title: 'Waiver Wire Advisor',
    description: 'Recommended adds and drops based on roster gaps, schedule density, and recent trends.',
  },
  {
    title: 'Trade Analyzer',
    description: 'Input a give/receive — Claude evaluates net category impact and positional balance.',
  },
  {
    title: 'Trade Value Index',
    description: 'Running power ranking of roster trade value. Who to sell high, buy low, or hold.',
  },
  {
    title: 'Start / Sit Advisor',
    description: 'Optimal weekly lineup given schedule, matchup, recent form, and injury status.',
  },
  {
    title: 'League Pulse',
    description: "Weekly league-wide summary — who's dominating, who's weak, who might trade.",
  },
]

export default function SeasonHub() {
  const router = useRouter()
  const league = useLeagueStore((s) => s.getActiveLeague())

  if (!league) {
    return (
      <div className="min-h-screen bg-bg text-gray-200 flex items-center justify-center">
        <p className="text-gray-500">No active league.</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{league.config.name || 'Season Hub'} — PocketBeane</title>
      </Head>
      <main className="min-h-screen bg-bg text-gray-200">
        <div className="max-w-3xl mx-auto px-8 py-12">

          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {league.config.name || 'Season Hub'}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {league.config.numTeams} teams · {league.config.scoringFormat?.toUpperCase() ?? '9CAT'}
                {league.config.yahooLeagueName && (
                  <span className="ml-2 text-gray-600">· {league.config.yahooLeagueName}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Home
            </button>
          </div>

          <p className="text-xs text-blue-400 font-mono mb-8">Season Mode</p>

          {/* Coming soon grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-surface border border-border rounded-lg px-5 py-4 opacity-60"
              >
                <p className="text-sm font-semibold text-gray-300 mb-1">{f.title}</p>
                <p className="text-xs text-gray-500">{f.description}</p>
                <p className="text-xs text-gray-700 mt-3 font-mono">Coming soon</p>
              </div>
            ))}
          </div>

        </div>
      </main>
    </>
  )
}
