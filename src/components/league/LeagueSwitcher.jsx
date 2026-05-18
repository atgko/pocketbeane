import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import useLeagueStore from '@/store/leagueStore'

const SHORTCUTS = [
  ['↑ ↓', 'navigate players'],
  ['U', 'draft → my team'],
  ['O', 'log opponent pick'],
  ['Enter', 'confirm pick'],
  ['/', 'focus search'],
  ['Esc', 'cancel / clear'],
  ['Z', 'undo last pick'],
]

function ShortcutsModal({ onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl p-6 w-72 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none">✕</button>
        </div>
        <div className="space-y-2.5">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <kbd className="text-xs font-mono text-gray-200 bg-white/10 border border-white/10 px-2 py-1 rounded min-w-[3rem] text-center shrink-0">
                {key}
              </kbd>
              <span className="text-xs font-mono text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function pickInfo(league) {
  const total = league.draft.picks.length
  const numTeams = league.config.numTeams || 10
  return {
    pick: total + 1,
    round: Math.ceil((total + 1) / numTeams),
  }
}

export default function LeagueSwitcher() {
  const router = useRouter()
  const { leagues, activeLeagueId, setActiveLeague } = useLeagueStore()
  const [showShortcuts, setShowShortcuts] = useState(false)

  const handleSwitch = (id) => {
    setActiveLeague(id)
    if (router.pathname !== '/draft') router.push('/draft')
  }

  const isDraft = router.pathname === '/draft'

  return (
    <>
      <div className="bg-surface border-b border-border flex items-stretch overflow-x-auto">
        {leagues.map((league) => {
          const { pick, round } = pickInfo(league)
          const isActive = activeLeagueId === league.id

          return (
            <button
              key={league.id}
              onClick={() => handleSwitch(league.id)}
              className={`flex items-center gap-2.5 px-5 py-3 text-sm border-b-2 whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? 'border-pick text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="font-medium">{league.config.name || `League`}</span>
              <span className={`font-mono text-xs tabular-nums ${isActive ? 'text-gray-400' : 'text-gray-700'}`}>
                R{round} · P{pick}
              </span>
            </button>
          )
        })}

        <div className="flex-1" />

        {isDraft && (
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center px-4 text-xs text-gray-600 hover:text-gray-300 transition-colors shrink-0"
            title="Keyboard shortcuts"
          >
            ⌨
          </button>
        )}

        <Link
          href="/"
          className="flex items-center px-4 text-xs text-gray-600 hover:text-gray-300 transition-colors shrink-0"
        >
          ← My Leagues
        </Link>
      </div>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  )
}
