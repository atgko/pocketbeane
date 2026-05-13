import { useState, useMemo, useRef, useEffect } from 'react'
import players from '@/data/players.json'
import FilterBar from './FilterBar'
import useLeagueStore from '@/store/leagueStore'

export default function PlayerPool() {
  const { activeLeagueId, addPick, undoPick, getActiveLeague } = useLeagueStore()
  const activeLeague = getActiveLeague()
  const picks = activeLeague?.draft?.picks ?? []

  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState(null)
  const [showAvailableOnly, setShowAvailableOnly] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [pendingPick, setPendingPick] = useState(null) // { playerId, draftedBy }

  const searchRef = useRef(null)
  const rowRefs = useRef({})

  const draftStatus = useMemo(() => {
    const map = {}
    for (const pick of picks) map[pick.playerId] = pick.draftedBy
    return map
  }, [picks])

  const filtered = useMemo(() => {
    let result = players

    if (showAvailableOnly) {
      result = result.filter(p => !draftStatus[p.id])
    }

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
  }, [search, posFilter, showAvailableOnly, draftStatus])

  // Clamp selection when filtered list shrinks
  useEffect(() => {
    setSelectedIndex(prev => {
      if (prev === null) return null
      if (filtered.length === 0) return null
      return Math.min(prev, filtered.length - 1)
    })
  }, [filtered.length])

  // Clear pending pick if the staged player was already drafted (e.g., after undo mismatch)
  useEffect(() => {
    if (pendingPick && !draftStatus[pendingPick.playerId] === false) {
      setPendingPick(null)
    }
  }, [draftStatus])

  // Scroll selected row into view
  useEffect(() => {
    if (selectedIndex !== null) {
      rowRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  // Mirror mutable refs for use in stable keyboard handler
  const filteredRef  = useRef(filtered)
  const selectedRef  = useRef(selectedIndex)
  const pendingRef   = useRef(pendingPick)
  const picksRef     = useRef(picks)
  useEffect(() => { filteredRef.current  = filtered },      [filtered])
  useEffect(() => { selectedRef.current  = selectedIndex }, [selectedIndex])
  useEffect(() => { pendingRef.current   = pendingPick },   [pendingPick])
  useEffect(() => { picksRef.current     = picks },         [picks])

  useEffect(() => {
    const onKeyDown = (e) => {
      const searching = document.activeElement === searchRef.current

      if (e.key === '/' && !searching) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }

      if (e.key === 'Escape') {
        if (searching) {
          searchRef.current?.blur()
          setSearch('')
        } else {
          setPendingPick(null)
        }
        return
      }

      // Pick shortcuts are blocked while typing in search
      if (searching) return

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => i === null ? 0 : Math.max(0, i - 1))
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => {
          const max = filteredRef.current.length - 1
          return i === null ? 0 : Math.min(max, i + 1)
        })
        return
      }

      if (e.key.toLowerCase() === 'u' && selectedRef.current !== null) {
        e.preventDefault()
        const player = filteredRef.current[selectedRef.current]
        if (player) setPendingPick({ playerId: player.id, draftedBy: 'user' })
        return
      }

      if (e.key.toLowerCase() === 'o' && selectedRef.current !== null) {
        e.preventDefault()
        const player = filteredRef.current[selectedRef.current]
        if (player) setPendingPick({ playerId: player.id, draftedBy: 'opponent' })
        return
      }

      if (e.key === 'Enter' && pendingRef.current) {
        e.preventDefault()
        const pick = pendingRef.current
        const pickNumber = picksRef.current.length + 1
        addPick(activeLeagueId, { ...pick, pickNumber })
        setPendingPick(null)
        return
      }

      if (e.key.toLowerCase() === 'z' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        undoPick(activeLeagueId)
        setPendingPick(null)
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeLeagueId, addPick, undoPick])

  return (
    <div>
      <FilterBar
        search={search}
        onSearch={setSearch}
        searchRef={searchRef}
        posFilter={posFilter}
        onPosFilter={setPosFilter}
        showAvailableOnly={showAvailableOnly}
        onToggleAvailable={() => setShowAvailableOnly(v => !v)}
      />

      {pendingPick && (
        <PendingBanner pendingPick={pendingPick} players={players} onCancel={() => setPendingPick(null)} />
      )}

      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-gray-500 text-xs uppercase tracking-wider">
              <th className="text-right px-4 py-3 w-12">#</th>
              <th className="text-left px-4 py-3">Player</th>
              <th className="text-left px-4 py-3 w-28">Pos</th>
              <th className="text-left px-4 py-3 w-16">Team</th>
              <th className="text-right px-4 py-3 w-16">ADP</th>
              <th className="w-8 px-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((player, i) => (
              <PlayerRow
                key={player.id}
                player={player}
                rank={i + 1}
                draftedBy={draftStatus[player.id]}
                isSelected={i === selectedIndex}
                isPending={pendingPick?.playerId === player.id}
                pendingDraftedBy={pendingPick?.playerId === player.id ? pendingPick.draftedBy : null}
                onClick={() => setSelectedIndex(i)}
                rowRef={el => { rowRefs.current[i] = el }}
              />
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
        {selectedIndex !== null && (
          <span className="ml-3 text-gray-700">↑↓ navigate · U user · O opponent · Enter confirm · Z undo</span>
        )}
      </p>
    </div>
  )
}

function PendingBanner({ pendingPick, players, onCancel }) {
  const player = players.find(p => p.id === pendingPick.playerId)
  const isUser = pendingPick.draftedBy === 'user'
  return (
    <div className={`flex items-center justify-between mb-3 px-4 py-2 rounded-lg text-xs font-mono border ${
      isUser
        ? 'bg-pick/10 border-pick/40 text-pick'
        : 'bg-gray-500/10 border-gray-500/40 text-gray-400'
    }`}>
      <span>
        {isUser ? 'Your pick:' : 'Opponent:'}{' '}
        <span className="font-semibold text-white">{player?.name}</span>
        {' '}— press <kbd className="px-1 py-0.5 rounded bg-white/10">Enter</kbd> to confirm
      </span>
      <button onClick={onCancel} className="hover:text-white transition-colors">✕</button>
    </div>
  )
}

function PlayerRow({ player, rank, draftedBy, isSelected, isPending, pendingDraftedBy, onClick, rowRef }) {
  const isDrafted = !!draftedBy

  let rowClass = 'border-b border-border last:border-0 cursor-pointer transition-colors'

  if (isPending) {
    rowClass += pendingDraftedBy === 'user'
      ? ' bg-pick/20'
      : ' bg-gray-500/15'
  } else if (isSelected) {
    rowClass += ' bg-white/10'
  } else if (isDrafted) {
    rowClass += draftedBy === 'user' ? ' opacity-50' : ' opacity-30'
  } else {
    rowClass += ' hover:bg-white/5'
  }

  return (
    <tr ref={rowRef} onClick={onClick} className={rowClass}>
      <td className="text-right px-4 py-2.5 text-gray-600 font-mono text-xs">{rank}</td>
      <td className="px-4 py-2.5">
        <span className={`font-medium ${draftedBy === 'opponent' ? 'line-through text-gray-500' : 'text-white'}`}>
          {player.name}
        </span>
        {player.injury_status !== 'healthy' && (
          <span className="ml-2 text-xs text-injury font-mono">
            {player.injury_status.toUpperCase()}
          </span>
        )}
        {player.injury_risk && (
          <span className="ml-1.5 text-xs text-injury/60 font-mono" title={player.injury_notes || 'Injury risk'}>
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
      <td className="px-2 py-2.5 text-center">
        {draftedBy === 'user' && (
          <span className="text-pick text-xs">✓</span>
        )}
        {isPending && (
          <span className={`text-xs font-mono ${pendingDraftedBy === 'user' ? 'text-pick' : 'text-gray-400'}`}>
            {pendingDraftedBy === 'user' ? 'U' : 'O'}
          </span>
        )}
      </td>
    </tr>
  )
}
