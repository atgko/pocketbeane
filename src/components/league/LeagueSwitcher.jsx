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

function CloseIcon({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  )
}

function GearIcon({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 1.5v1.4M8 13.1v1.4M14.5 8h-1.4M2.9 8H1.5M12.36 3.64l-.99.99M4.63 11.37l-.99.99M12.36 12.36l-.99-.99M4.63 4.63l-.99-.99" />
    </svg>
  )
}

function KeyboardIcon({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.3" />
      <circle cx="4.2" cy="6.5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="6.7" cy="6.5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="9.3" cy="6.5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="11.8" cy="6.5" r="0.4" fill="currentColor" stroke="none" />
      <line x1="4" y1="9.7" x2="12" y2="9.7" />
    </svg>
  )
}

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
        className="bg-surface-raised border border-surface-line rounded-xl p-6 w-72 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink-primary">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="inline-flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors">
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-2.5">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <kbd className="text-xs font-mono text-ink-primary bg-surface-overlay border border-surface-line px-2 py-1 rounded min-w-[3rem] text-center shrink-0">
                {key}
              </kbd>
              <span className="text-xs font-mono text-ink-secondary">{label}</span>
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
  const { leagues, activeLeagueId, setActiveLeague, getActiveLeague } = useLeagueStore()
  const [showShortcuts, setShowShortcuts] = useState(false)

  const handleSwitch = (id) => {
    setActiveLeague(id)
    if (router.pathname !== '/draft') router.push('/draft')
  }

  const isDraft = router.pathname === '/draft'
  const activeLeague = getActiveLeague()
  const draftComplete = Boolean(activeLeague?.config?.draftSynced) || activeLeague?.status === 'complete'

  return (
    <>
      <div className="bg-surface-raised border-b border-surface-line flex items-stretch overflow-x-auto">
        {leagues.map((league) => {
          const { pick, round } = pickInfo(league)
          const isActive = activeLeagueId === league.id

          return (
            <button
              key={league.id}
              onClick={() => handleSwitch(league.id)}
              className={`flex items-center gap-2.5 px-5 py-3 text-sm border-b-2 whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? 'border-beane-green text-ink-primary'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <span className="font-medium">{league.config.name || `League`}</span>
              <span className={`font-mono text-xs tabular-nums ${isActive ? 'text-ink-secondary' : 'text-ink-muted'}`}>
                R{round} · P{pick}
              </span>
            </button>
          )
        })}

        <div className="flex-1" />

        {isDraft && !draftComplete && (
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center px-4 text-ink-muted hover:text-ink-primary transition-colors shrink-0"
            title="Keyboard shortcuts"
          >
            <KeyboardIcon />
          </button>
        )}

        <Link
          href="/gm-profile"
          className="flex items-center px-3 text-ink-muted hover:text-ink-primary transition-colors shrink-0"
          title="GM Profile"
        >
          <GearIcon />
        </Link>

        <Link
          href="/"
          className="flex items-center px-4 text-xs text-ink-muted hover:text-ink-primary transition-colors shrink-0"
        >
          ← My Leagues
        </Link>
      </div>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  )
}
