import { useState, useRef, useMemo } from 'react'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import { getSportConfig } from '@/config/sports'
import {
  buildPlayerMap,
  computeRosterAssignment,
} from '@/utils/roster'
import UndoModal from './UndoModal'
import useLeagueStore from '@/store/leagueStore'

const PLAYER_DATA = { nba: nbaPlayers, mlb: mlbPlayers }

export default function RosterView({ league }) {
  const { removePick, reassignPick } = useLeagueStore()
  const { config, draft } = league
  const picks = draft.picks
  const sportConfig = getSportConfig(config.sport)
  const players = PLAYER_DATA[config.sport] ?? nbaPlayers
  const playerMap = useMemo(() => buildPlayerMap(players), [players])

  const [undoTarget, setUndoTarget] = useState(null)
  const [reassignError, setReassignError] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [flipping, setFlipping] = useState(false)
  const flipTimer = useRef(null)

  function handleFlip() {
    if (flipping) return
    setFlipping(true)
    flipTimer.current = setTimeout(() => {
      setShowHistory(v => !v)
      setFlipping(false)
    }, 180)
  }

  const isAuction = config.draftType === 'auction'
  const userPicks = picks.filter(p => p.draftedBy === 'user')
  const slots = computeRosterAssignment(config, userPicks, playerMap, sportConfig)
  const isFull = userPicks.length >= slots.length

  const pickByPlayerId = {}
  for (const pick of picks) pickByPlayerId[pick.playerId] = pick

  const starterSlots = slots.filter(s => s.type !== 'BN')
  const benchSlots   = slots.filter(s => s.type === 'BN')

  function handleReturnToBoard() {
    removePick(league.id, undoTarget.playerId)
    setUndoTarget(null)
    setReassignError(null)
  }

  function handleReassign(newDraftedBy) {
    if (newDraftedBy === 'user' && config.draftType === 'snake') {
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
    reassignPick(league.id, undoTarget.playerId, newDraftedBy)
    setReassignError(null)
    setUndoTarget(null)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 bg-surface-raised rounded-lg border border-surface-line p-4 flex flex-col">
        {/* Header */}
        <h3 className="text-xs text-ink-secondary uppercase tracking-wider font-mono mb-3 shrink-0">
          {showHistory ? 'Pick History' : 'Your Roster'}
        </h3>

        {/* Animated content area — fills all space between header and flip button */}
        <div
          className="flex-1 min-h-0 transition-all duration-[180ms]"
          style={{ opacity: flipping ? 0 : 1, transform: flipping ? 'translateY(4px)' : 'translateY(0)' }}
        >
          {showHistory ? (
            <PickHistory picks={picks} playerMap={playerMap} onEdit={pick => setUndoTarget(pick)} isAuction={isAuction} />
          ) : (
            <div className="h-full flex flex-col">
              {starterSlots.map((slot, i) => (
                <SlotRow
                  key={i}
                  slot={slot}
                  player={playerMap[slot.playerId]}
                  pick={slot.playerId ? pickByPlayerId[slot.playerId] : null}
                  onEdit={pick => setUndoTarget(pick)}
                  isAuction={isAuction}
                />
              ))}
              {benchSlots.map((slot, i) => (
                <SlotRow
                  key={`bn-${i}`}
                  slot={slot}
                  player={playerMap[slot.playerId]}
                  pick={slot.playerId ? pickByPlayerId[slot.playerId] : null}
                  onEdit={pick => setUndoTarget(pick)}
                  isBench
                  isAuction={isAuction}
                />
              ))}
            </div>
          )}
        </div>

        {/* Flip toggle — pinned to bottom of card */}
        <button
          onClick={handleFlip}
          className="mt-3 shrink-0 w-full pt-3 border-t border-surface-line text-xs font-mono text-ink-muted hover:text-ink-primary transition-colors text-center"
        >
          {showHistory ? '← Your Roster' : 'Pick History →'}
        </button>
      </div>

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

function SlotRow({ slot, player, pick, isBench, onEdit, isAuction }) {
  return (
    <div className="flex-1 flex items-center gap-2 min-h-0 group">
      <span className={`text-xs font-mono w-8 shrink-0 ${isBench ? 'text-ink-muted' : 'text-ink-secondary'}`}>
        {slot.type}
      </span>
      {player ? (
        <>
          <span className="text-xs text-ink-primary truncate flex-1">{player.name}</span>
          {isAuction && pick?.price != null && (
            <span className="text-xs font-mono tabular-nums text-ink-secondary shrink-0">${pick.price}</span>
          )}
          <button
            onClick={() => onEdit(pick)}
            className="text-xs text-ink-muted hover:text-ink-primary opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-auto px-1"
            title="Edit pick"
          >
            ↩
          </button>
        </>
      ) : (
        <span className="text-xs text-ink-muted font-mono">—</span>
      )}
    </div>
  )
}

function PickHistory({ picks, playerMap, onEdit, isAuction }) {
  if (picks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-ink-muted font-mono">No picks yet.</p>
      </div>
    )
  }

  const rows = [...picks].reverse().slice(0, 15)

  return (
    <div className="h-full flex flex-col">
      {rows.map((pick) => {
        const player = playerMap[pick.playerId]
        const isUser = pick.draftedBy === 'user'
        return (
          <div key={pick.pickNumber} className="flex-1 flex items-center gap-2 min-h-0 group">
            <span className="text-xs font-mono tabular-nums text-ink-muted w-6 shrink-0 text-right">
              {pick.pickNumber}
            </span>
            <span className={`text-xs font-mono w-7 shrink-0 ${isUser ? 'text-beane-green-text' : 'text-ink-muted'}`}>
              {isUser ? 'You' : 'OPP'}
            </span>
            <span className={`text-xs truncate flex-1 ${isUser ? 'text-ink-primary' : 'text-ink-secondary'}`}>
              {player?.name ?? '—'}
            </span>
            {isAuction && isUser && pick.price != null && (
              <span className="text-xs font-mono tabular-nums text-ink-secondary shrink-0">${pick.price}</span>
            )}
            <button
              onClick={() => onEdit(pick)}
              className="text-xs text-ink-muted hover:text-ink-primary opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-auto px-1"
              title="Edit pick"
            >
              ↩
            </button>
          </div>
        )
      })}
    </div>
  )
}
