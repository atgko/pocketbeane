import { useState, useRef } from 'react'
import players from '@/data/players.json'
import { getSportConfig } from '@/config/sports'
import {
  buildPlayerMap,
  computeRosterAssignment,
} from '@/utils/roster'
import UndoModal from './UndoModal'
import useLeagueStore from '@/store/leagueStore'

const playerMap = buildPlayerMap(players)

export default function RosterView({ league }) {
  const { removePick, reassignPick } = useLeagueStore()
  const { config, draft } = league
  const picks = draft.picks
  const sportConfig = getSportConfig(config.sport)

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
      <div className="flex-1 min-h-0 bg-surface rounded-lg border border-border p-4 flex flex-col">
        {/* Header */}
        <h3 className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-3 shrink-0">
          {showHistory ? 'Pick History' : 'Your Roster'}
        </h3>

        {/* Animated content area — fills all space between header and flip button */}
        <div
          className="flex-1 min-h-0 transition-all duration-[180ms]"
          style={{ opacity: flipping ? 0 : 1, transform: flipping ? 'translateY(4px)' : 'translateY(0)' }}
        >
          {showHistory ? (
            <PickHistory picks={picks} playerMap={playerMap} onEdit={pick => setUndoTarget(pick)} rowCount={slots.length} />
          ) : (
            <>
              <div className="space-y-0.5">
                {starterSlots.map((slot, i) => (
                  <SlotRow
                    key={i}
                    slot={slot}
                    player={playerMap[slot.playerId]}
                    pick={slot.playerId ? pickByPlayerId[slot.playerId] : null}
                    onEdit={pick => setUndoTarget(pick)}
                  />
                ))}
              </div>

              {benchSlots.length > 0 && (
                <div className="space-y-0.5">
                  {benchSlots.map((slot, i) => (
                    <SlotRow
                      key={i}
                      slot={slot}
                      player={playerMap[slot.playerId]}
                      pick={slot.playerId ? pickByPlayerId[slot.playerId] : null}
                      onEdit={pick => setUndoTarget(pick)}
                      isBench
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Flip toggle — pinned to bottom of card */}
        <button
          onClick={handleFlip}
          className="mt-3 shrink-0 w-full pt-3 border-t border-border text-xs font-mono text-gray-600 hover:text-gray-300 transition-colors text-center"
        >
          {showHistory ? '← Your Roster' : 'Pick History →'}
        </button>
      </div>

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

function SlotRow({ slot, player, pick, isBench, onEdit }) {
  return (
    <div className="flex items-center gap-2 py-0.5 group">
      <span className={`text-xs font-mono w-8 shrink-0 ${isBench ? 'text-gray-600' : 'text-gray-500'}`}>
        {slot.type}
      </span>
      {player ? (
        <>
          <span className="text-xs text-white truncate flex-1">{player.name}</span>
          <button
            onClick={() => onEdit(pick)}
            className="text-xs text-gray-700 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-auto px-1"
            title="Edit pick"
          >
            ↩
          </button>
        </>
      ) : (
        <span className="text-xs text-gray-700 font-mono">—</span>
      )}
    </div>
  )
}

function PickHistory({ picks, playerMap, onEdit, rowCount }) {
  const recent = [...picks].reverse().slice(0, rowCount)
  const rows = [...recent, ...Array(Math.max(0, rowCount - recent.length)).fill(null)]

  return (
    <div className="space-y-0.5">
      {rows.map((pick, i) => {
        if (!pick) {
          return (
            <div key={`empty-${i}`} className="flex items-center gap-2 py-0.5">
              <span className="text-xs font-mono text-gray-800 w-6 shrink-0" />
              <span className="text-xs font-mono text-gray-800 w-7 shrink-0" />
              <span className="text-xs text-gray-800 flex-1">—</span>
            </div>
          )
        }
        const player = playerMap[pick.playerId]
        const isUser = pick.draftedBy === 'user'
        return (
          <div key={pick.pickNumber} className="flex items-center gap-2 py-0.5 group">
            <span className="text-xs font-mono text-gray-600 w-6 shrink-0 text-right">
              {pick.pickNumber}
            </span>
            <span className={`text-xs font-mono w-7 shrink-0 ${isUser ? 'text-pick' : 'text-gray-600'}`}>
              {isUser ? 'You' : 'OPP'}
            </span>
            <span className={`text-xs truncate flex-1 ${isUser ? 'text-white' : 'text-gray-500'}`}>
              {player?.name ?? '—'}
            </span>
            <button
              onClick={() => onEdit(pick)}
              className="text-xs text-gray-700 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-auto px-1"
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
