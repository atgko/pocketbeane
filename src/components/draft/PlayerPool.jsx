import { useState, useMemo, useRef, useEffect } from 'react'
import players from '@/data/players.json'
import FilterBar from './FilterBar'

export default function PlayerPool() {
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState(null)
  const searchRef = useRef(null)

  // `/` key focuses search
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        searchRef.current?.blur()
        setSearch('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filtered = useMemo(() => {
    let result = players

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q))
    }

    if (posFilter) {
      if (posFilter === 'G') {
        result = result.filter(p => p.yahoo_positions.some(pos => ['PG', 'SG'].includes(pos)))
      } else if (posFilter === 'F') {
        result = result.filter(p => p.yahoo_positions.some(pos => ['SF', 'PF'].includes(pos)))
      } else {
        result = result.filter(p => p.yahoo_positions.includes(posFilter))
      }
    }

    return result
  }, [search, posFilter])

  return (
    <div>
      <FilterBar
        search={search}
        onSearch={setSearch}
        posFilter={posFilter}
        onPosFilter={setPosFilter}
        searchRef={searchRef}
      />

      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-gray-500 text-xs uppercase tracking-wider">
              <th className="text-right px-4 py-3 w-12">#</th>
              <th className="text-left px-4 py-3">Player</th>
              <th className="text-left px-4 py-3 w-28">Pos</th>
              <th className="text-left px-4 py-3 w-16">Team</th>
              <th className="text-right px-4 py-3 w-16">ADP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((player, i) => (
              <PlayerRow key={player.id} player={player} rank={i + 1} />
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-gray-600 text-sm font-mono">
            No players match your filters.
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-2 font-mono px-1">
        {filtered.length} of {players.length} players
      </p>
    </div>
  )
}

function PlayerRow({ player, rank }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-white/5 cursor-pointer transition-colors group">
      <td className="text-right px-4 py-2.5 text-gray-600 font-mono text-xs">{rank}</td>
      <td className="px-4 py-2.5">
        <span className="font-medium text-white">{player.name}</span>
        {player.injury_status !== 'healthy' && (
          <span className="ml-2 text-xs text-injury font-mono">
            {player.injury_status.toUpperCase()}
          </span>
        )}
        {player.injury_risk && (
          <span
            className="ml-1.5 text-xs text-injury/60 font-mono"
            title={player.injury_notes || 'Injury risk'}
          >
            ⚠
          </span>
        )}
        {player.contract_year && (
          <span className="ml-2 text-xs text-value font-mono" title="Contract year">CY</span>
        )}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-300">
        {player.yahoo_positions.join('/')}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{player.team}</td>
      <td className="text-right px-4 py-2.5 font-mono text-xs text-gray-400">
        {player.adp.toFixed(1)}
      </td>
    </tr>
  )
}
