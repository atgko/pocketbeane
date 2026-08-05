import { useState } from 'react'

const SPORT_LABELS = { nba: 'NBA', mlb: 'MLB' }

// Compact single switcher (D01 mockup 4.1: "LeagueName (SPORT) ▾") —
// replaces an earlier multi-pill row that just duplicated what the league
// grid below already shows. Picks which league drives the Hero/Beane's
// Note; doesn't affect the league list. The dropdown only opens when
// there's actually more than one league to switch to — with just one, this
// is a static label giving the hero context, matching the mockup either way.
export default function LeagueSwitcher({ leagues, activeId, onSelect }) {
  const [open, setOpen] = useState(false)
  const active = leagues.find(l => l.id === activeId) ?? leagues[0]
  if (!active) return null

  const canSwitch = leagues.length > 1

  return (
    <div className="relative">
      <button
        onClick={() => canSwitch && setOpen(o => !o)}
        title={canSwitch ? 'Switch league — or press [ / ]' : undefined}
        aria-haspopup={canSwitch ? 'listbox' : undefined}
        aria-expanded={canSwitch ? open : undefined}
        className={`flex items-center gap-2 bg-surface-raised border border-surface-line rounded-lg px-3 py-1.5 text-sm font-medium text-ink-primary transition-colors ${
          canSwitch ? 'hover:border-ink-secondary cursor-pointer' : 'cursor-default'
        }`}
      >
        <span className="font-mono text-micro text-ink-muted">
          {SPORT_LABELS[active.config.sport] ?? (active.config.sport ?? 'nba').toUpperCase()}
        </span>
        {active.config.name || 'Unnamed League'}
        {canSwitch && <span className="text-ink-muted text-micro">▾</span>}
      </button>

      {open && canSwitch && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-surface-overlay border border-surface-line rounded-lg overflow-hidden min-w-full whitespace-nowrap shadow-lg">
          {leagues.map(l => (
            <button
              key={l.id}
              onClick={() => { onSelect(l.id); setOpen(false) }}
              className={`block w-full text-left px-3 py-2 text-xs hover:bg-surface-line/40 transition-colors ${
                l.id === active.id ? 'text-beane-green-text' : 'text-ink-primary'
              }`}
            >
              <span className="font-mono text-micro text-ink-muted mr-1.5">
                {SPORT_LABELS[l.config.sport] ?? (l.config.sport ?? 'nba').toUpperCase()}
              </span>
              {l.config.name || 'Unnamed League'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
