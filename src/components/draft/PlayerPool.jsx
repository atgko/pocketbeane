import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import players from '@/data/players.json'
import FilterBar from './FilterBar'
import UndoModal from './UndoModal'
import useLeagueStore from '@/store/leagueStore'
import { getSportConfig } from '@/config/sports'

export default function PlayerPool() {
  const { activeLeagueId, addPick, undoPick, removePick, reassignPick, getActiveLeague } = useLeagueStore()
  const activeLeague = getActiveLeague()
  const picks = activeLeague?.draft?.picks ?? []
  const sportConfig = getSportConfig(activeLeague?.config?.sport)
  const draftType = activeLeague?.config?.draftType ?? 'snake'
  const totalSlots = activeLeague?.rosterSlots?.length ?? Infinity

  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState(null)
  const [showAvailableOnly, setShowAvailableOnly] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [pendingPick, setPendingPick] = useState(null)
  const [undoTarget, setUndoTarget] = useState(null)
  const [blockMessage, setBlockMessage] = useState(null)
  const [reassignError, setReassignError] = useState(null)

  const searchRef = useRef(null)
  const rowRefs = useRef({})
  const blockTimerRef = useRef(null)

  const userPicks = useMemo(() => picks.filter(p => p.draftedBy === 'user'), [picks])
  const isRosterFull = userPicks.length >= totalSlots

  const consecutiveUserPicks = useMemo(() => {
    let count = 0
    for (let i = picks.length - 1; i >= 0; i--) {
      if (picks[i].draftedBy === 'user') count++
      else break
    }
    return count
  }, [picks])

  const isSnakeLimitHit = draftType === 'snake' && consecutiveUserPicks >= 2

  const pickMap = useMemo(() => {
    const map = {}
    for (const pick of picks) map[pick.playerId] = pick
    return map
  }, [picks])

  const filtered = useMemo(() => {
    let result = players

    if (showAvailableOnly) {
      result = result.filter(p => !pickMap[p.id])
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q))
    }

    if (posFilter) {
      const eligiblePositions = sportConfig.slotEligibility[posFilter]
      if (eligiblePositions) {
        result = result.filter(p => p.yahoo_positions.some(pos => eligiblePositions.includes(pos)))
      } else {
        result = result.filter(p => p.yahoo_positions.includes(posFilter))
      }
    }

    return result
  }, [search, posFilter, showAvailableOnly, pickMap, activeLeague?.config?.sport])

  useEffect(() => {
    setSelectedIndex(prev => {
      if (prev === null) return null
      if (filtered.length === 0) return null
      return Math.min(prev, filtered.length - 1)
    })
  }, [filtered.length])

  useEffect(() => {
    if (selectedIndex !== null) {
      rowRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  const filteredRef     = useRef(filtered)
  const selectedRef     = useRef(selectedIndex)
  const pendingRef      = useRef(pendingPick)
  const picksRef        = useRef(picks)
  const undoTargetRef   = useRef(undoTarget)
  useEffect(() => { filteredRef.current   = filtered },      [filtered])
  useEffect(() => { selectedRef.current   = selectedIndex }, [selectedIndex])
  useEffect(() => { pendingRef.current    = pendingPick },   [pendingPick])
  useEffect(() => { picksRef.current      = picks },         [picks])
  useEffect(() => { undoTargetRef.current = undoTarget },    [undoTarget])

  const showBlock = useCallback((msg) => {
    if (blockTimerRef.current) clearTimeout(blockTimerRef.current)
    setBlockMessage(msg)
    blockTimerRef.current = setTimeout(() => setBlockMessage(null), 3500)
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      // When the edit modal is open, only allow Escape to close it
      if (undoTargetRef.current) {
        if (e.key === 'Escape') {
          setPendingPick(null)
          setUndoTarget(null)
          setReassignError(null)
        }
        return
      }

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
          setUndoTarget(null)
        }
        return
      }

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
        if (isRosterFull) {
          showBlock('Your roster is full. Undo a pick if you made a mistake.')
          return
        }
        if (isSnakeLimitHit) {
          showBlock("You've already picked twice in a row — impossible in a snake draft. Undo or add an opponent pick first.")
          return
        }
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
        // Re-check limits at confirm time
        if (pick.draftedBy === 'user') {
          if (isRosterFull) {
            showBlock('Your roster is full. Undo a pick if you made a mistake.')
            setPendingPick(null)
            return
          }
          if (isSnakeLimitHit) {
            showBlock("You've already picked twice in a row — impossible in a snake draft.")
            setPendingPick(null)
            return
          }
        }
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
  }, [activeLeagueId, addPick, undoPick, isRosterFull, isSnakeLimitHit, showBlock])

  function handleDraftAs(player, draftedBy) {
    if (draftedBy === 'user') {
      if (isRosterFull) {
        showBlock('Your roster is full. Undo a pick if you made a mistake.')
        return
      }
      if (isSnakeLimitHit) {
        showBlock("You've already picked twice in a row — impossible in a snake draft.")
        return
      }
    }
    const pickNumber = picks.length + 1
    addPick(activeLeagueId, { playerId: player.id, draftedBy, pickNumber })
  }

  function handleEditPick(pick) {
    setUndoTarget(pick)
  }

  function handleReturnToBoard() {
    removePick(activeLeagueId, undoTarget.playerId)
    setPendingPick(null)
    setUndoTarget(null)
    setReassignError(null)
  }

  function handleReassign(newDraftedBy) {
    if (newDraftedBy === 'user' && draftType === 'snake') {
      const simulated = picks.map(p =>
        p.playerId === undoTarget.playerId ? { ...p, draftedBy: 'user' } : p
      )
      let run = 0
      for (const p of simulated) {
        if (p.draftedBy === 'user') { run++; if (run >= 3) break }
        else run = 0
      }
      if (run >= 3) {
        setReassignError("Can't reassign — that would create 3 picks in a row, which breaks the snake draft rule.")
        return
      }
    }
    reassignPick(activeLeagueId, undoTarget.playerId, newDraftedBy)
    setReassignError(null)
    setUndoTarget(null)
  }

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
        filterPositions={sportConfig.filterPositions}
      />

      {pendingPick && (
        <PendingBanner pendingPick={pendingPick} players={players} onCancel={() => setPendingPick(null)} />
      )}

      {blockMessage && (
        <div className="flex items-center justify-between mb-3 px-4 py-2 rounded-lg text-xs font-mono border bg-red-500/10 border-red-500/30 text-red-400">
          <span>{blockMessage}</span>
          <button onClick={() => setBlockMessage(null)} className="hover:text-white transition-colors ml-4">✕</button>
        </div>
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
              <th className="w-28 px-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((player, i) => (
              <PlayerRow
                key={player.id}
                player={player}
                rank={i + 1}
                pick={pickMap[player.id] ?? null}
                isSelected={i === selectedIndex}
                isPending={pendingPick?.playerId === player.id}
                pendingDraftedBy={pendingPick?.playerId === player.id ? pendingPick.draftedBy : null}
                onClick={() => setSelectedIndex(i)}
                onDraftAsUser={() => handleDraftAs(player, 'user')}
                onDraftAsOpponent={() => handleDraftAs(player, 'opponent')}
                onEdit={() => handleEditPick(pickMap[player.id])}
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
      </p>

      <KeyboardLegend />

      {undoTarget && (
        <UndoModal
          pick={undoTarget}
          onReturnToBoard={handleReturnToBoard}
          onReassign={handleReassign}
          onCancel={() => { setUndoTarget(null); setReassignError(null) }}
          reassignError={reassignError}
        />
      )}
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

function PlayerRow({
  player, rank, pick, isSelected, isPending, pendingDraftedBy,
  onClick, onDraftAsUser, onDraftAsOpponent, onEdit, rowRef,
}) {
  const isDrafted = !!pick
  const draftedBy = pick?.draftedBy ?? null

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
          <span className="ml-2 text-xs text-value font-mono" title="Contract year — final season of deal">CY</span>
        )}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-300">
        {player.yahoo_positions.join('/')}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{player.team}</td>
      <td className="text-right px-4 py-2.5 font-mono text-xs text-gray-400">
        {player.adp.toFixed(1)}
      </td>
      <td className="px-2 py-2.5 text-center" onClick={e => isDrafted && e.stopPropagation()}>
        {isDrafted ? (
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className={`text-xs font-mono px-1.5 py-0.5 rounded transition-colors ${
              isSelected
                ? 'bg-white/10 text-gray-300 hover:text-white'
                : 'text-gray-600 hover:text-gray-400'
            }`}
            title="Edit this pick"
          >
            ↩
          </button>
        ) : isSelected ? (
          <div className="flex items-center gap-1 justify-center">
            <button
              onClick={e => { e.stopPropagation(); onDraftAsUser() }}
              className="text-xs px-1.5 py-0.5 rounded bg-pick/20 text-pick hover:bg-pick/40 font-mono transition-colors"
            >
              Me
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDraftAsOpponent() }}
              className="text-xs px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 hover:bg-gray-500/40 font-mono transition-colors"
            >
              Opp
            </button>
          </div>
        ) : isPending ? (
          <span className={`text-xs font-mono ${pendingDraftedBy === 'user' ? 'text-pick' : 'text-gray-400'}`}>
            {pendingDraftedBy === 'user' ? 'U' : 'O'}
          </span>
        ) : null}
      </td>
    </tr>
  )
}

function KeyboardLegend() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const containerRef = useRef(null)
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const didDrag = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      x: window.innerWidth - width - 16,
      y: window.innerHeight - height - 16,
    })
  }, [])

  function handleMouseDown(e) {
    e.preventDefault()
    didDrag.current = false
    const rect = containerRef.current.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    dragging.current = true

    function onMouseMove(e) {
      if (!dragging.current) return
      didDrag.current = true
      const el = containerRef.current
      const x = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - el.offsetWidth))
      const y = Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - el.offsetHeight))
      setPos({ x, y })
    }

    function onMouseUp() {
      dragging.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function handleClick() {
    if (didDrag.current) return
    setOpen(v => !v)
  }

  const posStyle = pos ? { left: pos.x, top: pos.y } : { bottom: 16, right: 16 }
  // Open upward when widget is in the lower half of the screen
  const opensUpward = pos === null || pos.y > window.innerHeight / 2

  const shortcuts = [
    ['↑ ↓', 'navigate'],
    ['U', 'draft → me'],
    ['O', 'draft → opp'],
    ['Enter', 'confirm'],
    ['/', 'search'],
    ['Esc', 'cancel'],
    ['Z', 'undo last'],
  ]

  const panel = open && (
    <div className={`${opensUpward ? 'mb-2' : 'mt-2'} bg-surface border border-border rounded-lg p-3 shadow-lg`}>
      <div className="space-y-1">
        {shortcuts.map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <kbd className="text-xs font-mono text-gray-300 bg-white/10 px-1.5 py-0.5 rounded min-w-[2.5rem] text-center">
              {key}
            </kbd>
            <span className="text-xs font-mono text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="fixed z-40 w-44" style={posStyle}>
      {opensUpward && panel}
      <button
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        className="w-full text-center text-xs font-mono text-gray-500 uppercase tracking-wider bg-surface border border-border rounded-lg px-3 py-1.5 shadow-lg hover:text-gray-300 hover:border-gray-500 transition-colors cursor-grab active:cursor-grabbing"
      >
        Shortcuts {open ? '▴' : '▾'}
      </button>
      {!opensUpward && panel}
    </div>
  )
}
