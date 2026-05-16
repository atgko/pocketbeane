import { useState } from 'react'
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
    <div className="space-y-3">

      {/* Roster slots */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-3">Your Roster</h3>

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
          <>
            <div className="border-t border-border my-2" />
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
          </>
        )}

        <p className={`text-xs font-mono mt-3 ${isFull ? 'text-pick font-semibold' : 'text-gray-700'}`}>
          {userPicks.length} / {slots.length} filled{isFull ? ' — roster full' : ''}
        </p>
      </div>

      {/* Pick history */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-3">Pick History</h3>
        <PickHistory picks={picks} playerMap={playerMap} onEdit={pick => setUndoTarget(pick)} />
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

function PickHistory({ picks, playerMap, onEdit }) {
  if (picks.length === 0) {
    return <p className="text-xs text-gray-700 font-mono">No picks yet.</p>
  }

  const recent = [...picks].reverse().slice(0, 12)

  return (
    <div className="space-y-0.5">
      {recent.map((pick) => {
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
