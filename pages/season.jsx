import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import useLeagueStore from '@/store/leagueStore'
import { useYahooAuth } from '@/hooks/useYahooAuth'

const COMING_SOON = [
  { title: 'Head-to-Head Matchup Advisor', description: 'Weekly category projections vs. your current opponent with lineup suggestions.' },
  { title: 'Waiver Wire Advisor', description: 'Recommended adds and drops based on roster gaps, schedule density, and recent trends.' },
  { title: 'Trade Analyzer', description: 'Input a give/receive — Claude evaluates net category impact and positional balance.' },
  { title: 'Trade Value Index', description: 'Running power ranking of roster trade value. Who to sell high, buy low, or hold.' },
  { title: 'Start / Sit Advisor', description: 'Optimal weekly lineup given schedule, matchup, recent form, and injury status.' },
  { title: 'League Pulse', description: "Weekly league-wide summary — who's dominating, who's weak, who might trade." },
]

function formatSyncedAt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function SeasonHub() {
  const router = useRouter()
  const league = useLeagueStore((s) => s.getActiveLeague())
  const { setLeagueRosters } = useLeagueStore()
  const yahoo = useYahooAuth()
  const [mounted, setMounted] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [expandedTeam, setExpandedTeam] = useState(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (league?.leagueRosters?.userTeamKey) {
      setExpandedTeam(league.leagueRosters.userTeamKey)
    }
  }, [league?.leagueRosters?.userTeamKey])

  if (!mounted) return null

  if (!league) {
    return (
      <div className="min-h-screen bg-bg text-gray-200 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No active league. <button onClick={() => router.push('/')} className="text-pick hover:underline">Go home →</button></p>
      </div>
    )
  }

  const rosters = league.leagueRosters ?? null
  const canSync = Boolean(league.config.yahooLeagueKey)

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const sport = league.config.sport ?? 'nba'
      const res = await fetch(`/api/yahoo/sync-rosters?leagueKey=${encodeURIComponent(league.config.yahooLeagueKey)}&sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setLeagueRosters(league.id, data)
      if (data.userTeamKey) setExpandedTeam(data.userTeamKey)
    } catch (err) {
      setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  function toggleTeam(teamKey) {
    setExpandedTeam(prev => prev === teamKey ? null : teamKey)
  }

  return (
    <>
      <Head>
        <title>{league.config.name || 'Season Hub'} — PocketBeane</title>
      </Head>
      <main className="min-h-screen bg-bg text-gray-200">
        <div className="max-w-3xl mx-auto px-8 py-12">

          {/* Header */}
          <div className="flex items-center justify-between mb-1">
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

          {/* Roster Sync section */}
          {canSync ? (
            <div className="mb-10">
              {!rosters ? (
                /* Pre-sync prompt */
                <div className="bg-surface border border-border rounded-lg p-5 mb-4">
                  <p className="text-sm font-semibold text-white mb-1">Sync league rosters</p>
                  <p className="text-xs text-gray-500 font-mono mb-4">
                    Pull all {league.config.numTeams} team rosters from Yahoo to enable season features.
                    {!yahoo.connected && <span className="text-yellow-500/70"> Connect to Yahoo first.</span>}
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={syncing || !yahoo.connected}
                    className="px-5 py-2 bg-pick text-white rounded-lg text-sm font-semibold hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {syncing ? 'Syncing…' : 'Sync Rosters from Yahoo'}
                  </button>
                  {syncError && <p className="text-xs text-red-400 mt-3 font-mono">{syncError}</p>}
                </div>
              ) : (
                /* Post-sync header */
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-mono text-gray-500">
                    Synced {formatSyncedAt(rosters.syncedAt)} · {rosters.matched}/{rosters.total} players matched
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="text-xs font-mono px-3 py-1.5 rounded bg-white/5 border border-border text-gray-400 hover:text-white hover:border-pick transition-colors disabled:opacity-40"
                  >
                    {syncing ? 'Syncing…' : 'Refresh'}
                  </button>
                </div>
              )}

              {syncError && rosters && (
                <p className="text-xs text-red-400 mb-3 font-mono">{syncError}</p>
              )}

              {/* League standings + rosters table */}
              {rosters && (
                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider">League Standings</h3>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-gray-600 uppercase tracking-wider">
                        <th className="text-left px-4 py-2 w-8">#</th>
                        <th className="text-left px-4 py-2">Team</th>
                        <th className="text-left px-4 py-2 hidden sm:table-cell text-gray-600">Manager</th>
                        <th className="text-center px-3 py-2 w-20">W–L</th>
                        <th className="text-right px-4 py-2 w-16">Players</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rosters.teams.map((team) => {
                        const isExpanded = expandedTeam === team.teamKey
                        return [
                          <tr
                            key={team.teamKey}
                            onClick={() => toggleTeam(team.teamKey)}
                            className={`border-b border-border cursor-pointer transition-colors ${
                              team.isUser ? 'bg-pick/5 hover:bg-pick/8' : 'hover:bg-white/3'
                            }`}
                          >
                            <td className="px-4 py-2.5 font-mono text-gray-600">{team.rank ?? '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={team.isUser ? 'text-pick font-semibold' : 'text-white font-medium'}>
                                {team.teamName}
                              </span>
                              {team.isUser && (
                                <span className="ml-2 text-xs font-mono text-pick/50">you</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell font-mono">{team.manager ?? '—'}</td>
                            <td className="px-3 py-2.5 text-center text-gray-400 font-mono tabular-nums">
                              {team.wins}–{team.losses}{team.ties > 0 ? `–${team.ties}` : ''}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-500 font-mono">
                              <span>{team.roster.length}</span>
                              <span className="ml-1.5 text-gray-700">{isExpanded ? '↑' : '↓'}</span>
                            </td>
                          </tr>,
                          isExpanded && (
                            <tr key={`${team.teamKey}-roster`} className={team.isUser ? 'bg-pick/3' : 'bg-white/2'}>
                              <td colSpan={5} className="px-4 py-3 border-b border-border">
                                <div className="flex flex-wrap gap-1.5">
                                  {team.roster.map((p, i) => (
                                    <span
                                      key={i}
                                      className={`text-xs font-mono px-2 py-0.5 rounded border ${
                                        p.playerId
                                          ? 'text-gray-300 border-border bg-white/3'
                                          : 'text-gray-600 border-border/40'
                                      }`}
                                    >
                                      {p.name ?? p.playerKey}
                                      {p.positions && (
                                        <span className="text-gray-600 ml-1">{p.positions}</span>
                                      )}
                                      {p.status && p.status !== 'active' && (
                                        <span className="text-yellow-500/70 ml-1">{p.status}</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ),
                        ]
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* No Yahoo key — prompt to link a league */
            <div className="bg-surface border border-border rounded-lg p-5 mb-10">
              <p className="text-sm text-gray-400">
                This league isn't linked to Yahoo.{' '}
                <button onClick={() => router.push(`/setup?id=${league.id}`)} className="text-pick hover:underline">
                  Edit league settings →
                </button>
              </p>
            </div>
          )}

          {/* Coming soon feature grid */}
          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-wider mb-3">Season Features</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {COMING_SOON.map((f) => (
                <div
                  key={f.title}
                  className="bg-surface border border-border rounded-lg px-5 py-4 opacity-50"
                >
                  <p className="text-sm font-semibold text-gray-300 mb-1">{f.title}</p>
                  <p className="text-xs text-gray-500">{f.description}</p>
                  <p className="text-xs text-gray-700 mt-3 font-mono">Coming soon</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
