import Modal from '@/components/ui/Modal'

export default function UndoModal({ pick, players = [], onReturnToBoard, onReassign, onCancel, reassignError }) {
  const player = players.find(p => p.id === pick.playerId)
  const isUserPick = pick.draftedBy === 'user'

  return (
    <Modal
      onClose={onCancel}
      labelledBy="undo-modal-title"
      className="bg-surface-raised border border-surface-line rounded-xl p-6 w-80 shadow-xl"
    >
      <h3 id="undo-modal-title" className="text-sm font-semibold text-ink-primary mb-1">Edit Pick</h3>
      <p className="text-xs text-ink-secondary font-mono mb-5">
        <span className="text-ink-primary">{player?.name ?? 'Unknown'}</span>
        {' '}— {isUserPick ? 'your pick' : 'opponent pick'}{pick.pickNumber ? ` #${pick.pickNumber}` : ''}
      </p>

      <div className="flex flex-col gap-2">
        <button
          onClick={onReturnToBoard}
          className="w-full px-4 py-2.5 rounded-lg bg-beane-green/20 text-beane-green-text text-sm font-mono hover:bg-beane-green/30 transition-colors text-left"
        >
          Return to board
        </button>
        <button
          onClick={() => onReassign(isUserPick ? 'opponent' : 'user')}
          className="w-full px-4 py-2.5 rounded-lg text-ink-primary text-sm font-mono hover:bg-surface-overlay transition-colors text-left"
        >
          {isUserPick ? 'Reassign as opponent pick' : 'Reassign as my pick'}
        </button>
        {reassignError && (
          <p role="alert" className="text-xs text-signal-down font-mono px-1">{reassignError}</p>
        )}
        <button
          onClick={onCancel}
          className="w-full px-4 py-2.5 rounded-lg text-ink-muted text-sm font-mono hover:text-ink-primary transition-colors text-left"
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
