import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'

const PLAYER_DATA = { nba: nbaPlayers, mlb: mlbPlayers }
import FilterBar from './FilterBar'
import UndoModal from './UndoModal'
import useLeagueStore from '@/store/leagueStore'
import { getSportConfig } from '@/config/sports'
import { isUserTurn } from '@/utils/snake'

export default function PlayerPool() {
  const { activeLeagueId, addPick, undoPick, removePick, reassignPick, getActiveLeague } = useLeagueStore()
  const activeLeague = getActiveLeague()
  const picks = activeLeague?.draft?.picks ?? []
  const sport = activeLeague?.config?.sport ?? 'nba'
  const sportConfig = getSportConfig(sport)
  const players = PLAYER_DATA[sport] ?? nbaPlayers
  const draftType = activeLeague?.config?.draftType ?? 'snake'
  const totalSlots = activeLeague?.rosterSlots?.length ?? Infinity
  const numTeams = activeLeague?.config?.numTeams ?? 10
  const draftPosition = activeLeague?.config?.draftPosition ?? 1
  const isYahooLinked = Boolean(activeLeague?.config?.yahooLeagueKey)

  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState(null)
  const [showAvailableOnly, setShowAvailableOnly] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [pendingPick, setPendingPick] = useState(null)
  const [undoTarget, setUndoTarget] = useState(null)
  const [blockMessage, setBlockMessage] = useState(null)
  const [reassignError, setReassignError] = useState(null)
  const [pendingPrice, setPendingPrice] = useState('')
  const pendingPriceRef = useRef('')
  const priceInputRef = useRef(null)
  const draftTypeRef = useRef(draftType)

  const searchRef = useRef(null)
  const rowRefs = useRef({})
  const blockTimerRef = useRef(null)

  const userPicks = useMemo(() => picks.filter(p => p.draftedBy === 'user'), [picks])
  const isRosterFull = userPicks.length >= totalSlots

  const currentPickNum = picks.length + 1
  // Turn enforcement only applies to snake drafts with a known draft position
  const isMyTurn = draftType === 'snake' && !isRosterFull
    ? isUserTurn(currentPickNum, draftPosition, numTeams)
    : true

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

  const filteredRef    = useRef(filtered)
  const selectedRef    = useRef(selectedIndex)
  const pendingRef     = useRef(pendingPick)
  const picksRef       = useRef(picks)
  const undoTargetRef  = useRef(undoTarget)
  const isMyTurnRef    = useRef(isMyTurn)
  const isRosterFullRef = useRef(isRosterFull)
  useEffect(() => { filteredRef.current     = filtered },      [filtered])
  useEffect(() => { selectedRef.current     = selectedIndex }, [selectedIndex])
  useEffect(() => { pendingRef.current      = pendingPick },   [pendingPick])
  useEffect(() => { picksRef.current        = picks },         [picks])
  useEffect(() => { undoTargetRef.current   = undoTarget },    [undoTarget])
  useEffect(() => { isMyTurnRef.current     = isMyTurn },      [isMyTurn])
  useEffect(() => { isRosterFullRef.current = isRosterFull },  [isRosterFull])
  useEffect(() => { pendingPriceRef.current = pendingPrice },  [pendingPrice])
  useEffect(() => { draftTypeRef.current   = draftType },     [draftType])

  const showBlock = useCallback((msg) => {
    if (blockTimerRef.current) clearTimeout(blockTimerRef.current)
    setBlockMessage(msg)
    blockTimerRef.current = setTimeout(() => setBlockMessage(null), 3500)
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
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
          setPendingPrice('')
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
        if (isYahooLinked) return
        if (isRosterFullRef.current) {
          showBlock('Your roster is full. Undo a pick if you made a mistake.')
          return
        }
        if (!isMyTurnRef.current && draftTypeRef.current !== 'auction') {
          showBlock("It's not your pick — log an opponent pick first (O).")
          return
        }
        const player = filteredRef.current[selectedRef.current]
        if (player) setPendingPick({ playerId: player.id, draftedBy: 'user' })
        return
      }

      if (e.key.toLowerCase() === 'o' && selectedRef.current !== null) {
        e.preventDefault()
        if (isYahooLinked) return
        if (isMyTurnRef.current && !isRosterFullRef.current && draftTypeRef.current !== 'auction') {
          showBlock("It's your pick! Use U to draft a player for your team.")
          return
        }
        const player = filteredRef.current[selectedRef.current]
        if (player) setPendingPick({ playerId: player.id, draftedBy: 'opponent' })
        return
      }

      if (e.key === 'Enter' && pendingRef.current) {
        e.preventDefault()
        if (isYahooLinked) return
        const pick = pendingRef.current
        if (pick.draftedBy === 'user') {
          if (isRosterFullRef.current) {
            showBlock('Your roster is full.')
            setPendingPick(null)
            return
          }
          if (!isMyTurnRef.current && draftTypeRef.current !== 'auction') {
            showBlock("It's not your pick.")
            setPendingPick(null)
            return
          }
          if (draftTypeRef.current === 'auction') {
            priceInputRef.current?.focus()
            return
          }
        }
        if (pick.draftedBy === 'opponent' && isMyTurnRef.current && !isRosterFullRef.current && draftTypeRef.current !== 'auction') {
          showBlock("It's your pick — use U to draft for your team.")
          setPendingPick(null)
          return
        }
        const pickNumber = picksRef.current.length + 1
        addPick(activeLeagueId, { ...pick, pickNumber })
        setPendingPick(null)
        return
      }

      if (e.key.toLowerCase() === 'z' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        if (isYahooLinked) return
        undoPick(activeLeagueId)
        setPendingPick(null)
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeLeagueId, addPick, undoPick, showBlock])

  function handleDraftAs(player, draftedBy) {
    if (draftedBy === 'user') {
      if (isRosterFull) {
        showBlock('Your roster is full. Undo a pick if you made a mistake.')
        return
      }
      if (!isMyTurn && draftType !== 'auction') {
        showBlock("It's not your pick — log an opponent pick first (O).")
        return
      }
    }
    if (draftedBy === 'opponent' && isMyTurn && !isRosterFull && draftType !== 'auction') {
      showBlock("It's your pick! Use U or click Me to draft a player.")
      return
    }
    const pickNumber = picks.length + 1
    if (draftType === 'auction' && draftedBy === 'user') {
      setPendingPick({ playerId: player.id, draftedBy: 'user' })
      return
    }
    addPick(activeLeagueId, { playerId: player.id, draftedBy, pickNumber, price: null })
  }

  function onConfirmWithPrice(price) {
    const pick = pendingPick
    if (!pick || pick.draftedBy !== 'user') return
    const pickNumber = picks.length + 1
    addPick(activeLeagueId, { ...pick, pickNumber, price })
    setPendingPick(null)
    setPendingPrice('')
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
    reassignPick(activeLeagueId, undoTarget.playerId, newDraftedBy)
    setReassignError(null)
    setUndoTarget(null)
  }

  const currentRound = Math.ceil(currentPickNum / numTeams)
  const turnLabel = isRosterFull
    ? null
    : draftType === 'auction'
      ? (isMyTurn ? `Your nomination — #${currentPickNum}` : `Nomination #${currentPickNum}`)
      : isMyTurn
        ? `Your pick — R${currentRound} · #${currentPickNum}`
        : `Opponents — R${currentRound} · #${currentPickNum}`

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearch={setSearch}
        searchRef={searchRef}
        posFilter={posFilter}
        onPosFilter={setPosFilter}
        showAvailableOnly={showAvailableOnly}
        onToggleAvailable={() => setShowAvailableOnly(v => !v)}
        filterPositions={sportConfig.filterPositions}
        turnLabel={turnLabel}
        isMyTurn={isMyTurn}
      />

      {pendingPick && (
        <PendingBanner
          pendingPick={pendingPick}
          players={players}
          onCancel={() => { setPendingPick(null); setPendingPrice('') }}
          isAuction={draftType === 'auction'}
          pendingPrice={pendingPrice}
          onPriceChange={setPendingPrice}
          onConfirmWithPrice={onConfirmWithPrice}
          priceInputRef={priceInputRef}
        />
      )}

      {blockMessage && (
        <div className="flex items-center justify-between px-4 py-2 rounded-lg text-xs font-mono border bg-signal-down/10 border-signal-down/30 text-signal-down">
          <span>{blockMessage}</span>
          <button onClick={() => setBlockMessage(null)} className="hover:text-ink-primary transition-colors ml-4">
            <IconClose className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="bg-surface-raised rounded-lg border border-surface-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-line text-ink-secondary text-xs uppercase tracking-wider">
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
                isMyTurn={isMyTurn}
                isYahooLinked={isYahooLinked}
                onClick={() => setSelectedIndex(i)}
                onDraftAsUser={() => handleDraftAs(player, 'user')}
                onDraftAsOpponent={() => handleDraftAs(player, 'opponent')}
                onEdit={() => handleEditPick(pickMap[player.id])}
                rowRef={el => { rowRefs.current[i] = el }}
                isAuction={draftType === 'auction'}
              />
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-ink-muted text-sm font-mono">
            No players match your filters.
          </div>
        )}
      </div>

      <p className="text-xs text-ink-muted font-mono px-1">
        {filtered.length} of {players.length} players
      </p>

      {undoTarget && (
        <UndoModal
          pick={undoTarget}
          players={players}
          onReturnToBoard={handleReturnToBoard}
          onReassign={handleReassign}
          onCancel={() => { setUndoTarget(null); setReassignError(null) }}
          reassignError={reassignError}
        />
      )}
    </div>
  )
}

function PendingBanner({ pendingPick, players, onCancel, isAuction, pendingPrice, onPriceChange, onConfirmWithPrice, priceInputRef }) {
  const player = players.find(p => p.id === pendingPick.playerId)
  const isUser = pendingPick.draftedBy === 'user'
  const needsPrice = isAuction && isUser
  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded-lg text-xs font-mono border ${
      isUser
        ? 'bg-beane-green/10 border-beane-green/40 text-beane-green-text'
        : 'bg-surface-overlay border-surface-line text-ink-secondary'
    }`}>
      <span className="flex items-center gap-1.5 flex-wrap">
        {isUser ? 'Your pick:' : 'Opponent:'}{' '}
        <span className="font-semibold text-ink-primary">{player?.name}</span>
        {needsPrice ? (
          <>
            <span className="text-ink-secondary">·</span>
            <span>$</span>
            <input
              ref={priceInputRef}
              type="number"
              min={1}
              max={999}
              value={pendingPrice}
              onChange={e => onPriceChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const price = Number(pendingPrice)
                  if (price >= 1) onConfirmWithPrice(price)
                }
                if (e.key === 'Escape') onCancel()
                e.stopPropagation()
              }}
              autoFocus
              placeholder="0"
              className="w-12 bg-surface-overlay border border-beane-green/30 rounded px-1.5 py-0.5 text-ink-primary text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-ink-secondary">— Enter to confirm</span>
          </>
        ) : (
          <span>— press <kbd className="px-1 py-0.5 rounded bg-surface-overlay">Enter</kbd> to confirm</span>
        )}
      </span>
      <button onClick={onCancel} className="hover:text-ink-primary transition-colors">
        <IconClose className="w-3 h-3" />
      </button>
    </div>
  )
}

function PlayerRow({
  player, rank, pick, isSelected, isPending, pendingDraftedBy, isMyTurn, isAuction, isYahooLinked,
  onClick, onDraftAsUser, onDraftAsOpponent, onEdit, rowRef,
}) {
  const isDrafted = !!pick
  const draftedBy = pick?.draftedBy ?? null

  let rowClass = 'border-b border-surface-line last:border-0 cursor-pointer transition-colors'

  if (isPending) {
    rowClass += pendingDraftedBy === 'user' ? ' bg-beane-green/20' : ' bg-surface-overlay/60'
  } else if (isSelected) {
    rowClass += ' bg-surface-overlay'
  } else if (isDrafted) {
    rowClass += draftedBy === 'user' ? ' opacity-50' : ' opacity-30'
  } else {
    rowClass += ' hover:bg-surface-overlay'
  }

  return (
    <tr ref={rowRef} onClick={onClick} className={rowClass}>
      <td className="text-right px-4 py-2.5 text-ink-muted font-mono text-xs">{rank}</td>
      <td className="px-4 py-2.5">
        <span className={`font-medium ${draftedBy === 'opponent' ? 'line-through text-ink-secondary' : 'text-ink-primary'}`}>
          {player.name}
        </span>
        {player.injury_status !== 'healthy' && (
          <span className="ml-2 text-xs text-signal-down font-mono">
            {player.injury_status.toUpperCase()}
          </span>
        )}
        {player.injury_risk && (
          <span className="ml-1.5 inline-flex align-middle text-signal-down/60" title={player.injury_notes || 'Injury risk'}>
            <IconWarning className="w-3 h-3" />
          </span>
        )}
        {player.contract_year && (
          <span className="ml-2 text-xs text-signal-watch font-mono" title="Contract year — final season of deal">CY</span>
        )}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-ink-primary">
        {player.yahoo_positions.join('/')}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-ink-secondary">{player.team}</td>
      <td className="text-right px-4 py-2.5 font-mono tabular-nums text-xs text-ink-secondary">
        {player.adp.toFixed(1)}
      </td>
      <td className="px-2 py-2.5 text-center" onClick={e => isDrafted && e.stopPropagation()}>
        {isYahooLinked ? null : isDrafted ? (
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className={`inline-flex items-center justify-center p-1 rounded transition-colors ${
              isSelected ? 'bg-surface-overlay text-ink-primary hover:text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'
            }`}
            title="Edit this pick"
          >
            <IconUndo className="w-3.5 h-3.5" />
          </button>
        ) : isSelected ? (
          <div className="flex items-center gap-1 justify-center">
            <button
              onClick={e => { e.stopPropagation(); onDraftAsUser() }}
              className={`text-xs px-1.5 py-0.5 rounded font-mono transition-colors ${
                isMyTurn || isAuction
                  ? 'bg-beane-green/20 text-beane-green-text hover:bg-beane-green/40'
                  : 'bg-surface-overlay/40 text-ink-muted cursor-not-allowed'
              }`}
              title={isMyTurn || isAuction ? 'Draft for my team' : "Not your turn"}
            >
              Me
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDraftAsOpponent() }}
              className={`text-xs px-1.5 py-0.5 rounded font-mono transition-colors ${
                !isMyTurn || isAuction
                  ? 'bg-surface-overlay/60 text-ink-secondary hover:bg-surface-overlay'
                  : 'bg-surface-overlay/40 text-ink-muted cursor-not-allowed'
              }`}
              title="Log as opponent pick"
            >
              Opp
            </button>
          </div>
        ) : isPending ? (
          <span className={`text-xs font-mono ${pendingDraftedBy === 'user' ? 'text-beane-green-text' : 'text-ink-secondary'}`}>
            {pendingDraftedBy === 'user' ? 'U' : 'O'}
          </span>
        ) : null}
      </td>
    </tr>
  )
}

function IconClose({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function IconWarning({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  )
}

function IconUndo({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a5 5 0 0 1 0 10h-1" />
    </svg>
  )
}
