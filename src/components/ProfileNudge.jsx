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
    <div className="bg-surface border-b border-border px-5 py-2 flex items-center justify-between gap-4">
      <p className="text-xs text-gray-500 font-mono">
        Complete your GM Profile for personalized picks
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpen}
          className="text-xs text-pick hover:text-green-400 transition-colors font-medium"
        >
          Set up profile →
        </button>
        <button
          onClick={dismiss}
          className="text-xs text-gray-700 hover:text-gray-500 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
