import { useState } from 'react'

const NUDGE_KEY = 'pb_nudge_dismissed'

export default function ProfileNudge({ onOpen }) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && Boolean(sessionStorage.getItem(NUDGE_KEY))
  )

  if (dismissed) return null

  function dismiss() {
    sessionStorage.setItem(NUDGE_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="bg-surface-raised border-b border-surface-line px-5 py-2 flex items-center justify-between gap-4">
      <p className="text-xs text-ink-secondary font-mono">
        Complete your GM Profile for personalized picks
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpen}
          className="text-xs text-beane-green-text hover:text-beane-green transition-colors font-medium"
        >
          Set up profile →
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-ink-muted hover:text-ink-secondary transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
