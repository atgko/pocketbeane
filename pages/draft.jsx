import Head from 'next/head'
import players from '@/data/players.json'

export default function Draft() {
  return (
    <>
      <Head>
        <title>Draft Board — PocketBeane</title>
      </Head>
      <main className="min-h-screen bg-bg text-gray-200">
        <div className="max-w-7xl mx-auto p-6">
          <header className="mb-6 flex items-baseline gap-4">
            <h1 className="text-2xl font-bold text-white">Draft Board</h1>
            <span className="text-gray-500 text-sm">{players.length} players loaded</span>
          </header>

          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-right px-4 py-3 w-12">#</th>
                  <th className="text-left px-4 py-3">Player</th>
                  <th className="text-left px-4 py-3 w-24">Pos</th>
                  <th className="text-left px-4 py-3 w-16">Team</th>
                  <th className="text-right px-4 py-3 w-16">ADP</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, i) => (
                  <tr
                    key={player.id}
                    className="border-b border-border last:border-0 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="text-right px-4 py-2.5 text-gray-500 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-white">{player.name}</span>
                      {player.injury_status !== 'healthy' && (
                        <span className="ml-2 text-xs text-injury font-mono">
                          {player.injury_status.toUpperCase()}
                        </span>
                      )}
                      {player.injury_risk && (
                        <span className="ml-2 text-xs text-injury/70 font-mono">⚠</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-300">
                      {player.positions.join('/')}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{player.team}</td>
                    <td className="text-right px-4 py-2.5 font-mono text-xs text-gray-300">
                      {player.adp.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  )
}
