import players from '@/data/players.json'

export default function UndoModal({ pick, onReturnToBoard, onReassign, onCancel }) {
  const player = players.find(p => p.id === pick.playerId)
  const isUserPick = pick.draftedBy === 'user'

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-surface border border-border rounded-xl p-6 w-80 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-1">Edit Pick</h3>
        <p className="text-xs text-gray-400 font-mono mb-5">
          <span className="text-white">{player?.name ?? 'Unknown'}</span>
          {' '}— {isUserPick ? 'your pick' : 'opponent pick'}{pick.pickNumber ? ` #${pick.pickNumber}` : ''}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onReturnToBoard}
            className="w-full px-4 py-2.5 rounded-lg bg-pick/20 text-pick text-sm font-mono hover:bg-pick/30 transition-colors text-left"
          >
            Return to board
          </button>
          <button
            onClick={() => onReassign(isUserPick ? 'opponent' : 'user')}
            className="w-full px-4 py-2.5 rounded-lg bg-white/5 text-gray-300 text-sm font-mono hover:bg-white/10 transition-colors text-left"
          >
            {isUserPick ? 'Reassign as opponent pick' : 'Reassign as my pick'}
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2.5 rounded-lg text-gray-500 text-sm font-mono hover:text-gray-300 transition-colors text-left"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
