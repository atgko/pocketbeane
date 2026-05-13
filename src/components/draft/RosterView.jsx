import players from '@/data/players.json'
import { CATEGORIES } from '@/constants/categories'
import {
  buildPlayerMap,
  computeRosterAssignment,
  computeCategoryTotals,
  formatStat,
} from '@/utils/roster'

const playerMap = buildPlayerMap(players)

export default function RosterView({ league }) {
  const { config, draft } = league
  const picks = draft.picks

  const userPicks = picks.filter(p => p.draftedBy === 'user')
  const slots = computeRosterAssignment(config, userPicks, playerMap)
  const totals = computeCategoryTotals(userPicks, playerMap)

  const starterSlots = slots.filter(s => s.type !== 'BN')
  const benchSlots   = slots.filter(s => s.type === 'BN')

  return (
    <div className="space-y-3 sticky top-6">

      {/* Roster slots */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-3">Your Roster</h3>

        <div className="space-y-0.5">
          {starterSlots.map((slot, i) => (
            <SlotRow key={i} slot={slot} player={playerMap[slot.playerId]} />
          ))}
        </div>

        {benchSlots.length > 0 && (
          <>
            <div className="border-t border-border my-2" />
            <div className="space-y-0.5">
              {benchSlots.map((slot, i) => (
                <SlotRow key={i} slot={slot} player={playerMap[slot.playerId]} isBench />
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-gray-700 font-mono mt-3">
          {userPicks.length} / {slots.length} filled
        </p>
      </div>

      {/* Category totals */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-3">Category Totals</h3>

        {totals ? (
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            {CATEGORIES.map(cat => (
              <div key={cat.id}>
                <div className="text-xs text-gray-500 font-mono">{cat.label}</div>
                <div className="text-sm text-white font-mono tabular-nums">
                  {formatStat(cat.id, totals[cat.id])}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-700 font-mono">No picks yet.</p>
        )}
      </div>
    </div>
  )
}

function SlotRow({ slot, player, isBench }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`text-xs font-mono w-8 shrink-0 ${isBench ? 'text-gray-600' : 'text-gray-500'}`}>
        {slot.type}
      </span>
      {player ? (
        <span className="text-xs text-white truncate">{player.name}</span>
      ) : (
        <span className="text-xs text-gray-700 font-mono">—</span>
      )}
    </div>
  )
}
