const SPORT_LABELS = { nba: 'NBA', mlb: 'MLB' }

// Top-bar league switcher (D01 brief 4.1) — "first-class control, not
// buried in settings." Selects which league's Hero/Beane's Note the
// homepage shows; doesn't affect the league list below. Only rendered by
// the caller when there's more than one non-archived league.
export default function LeagueSwitcher({ leagues, activeId, onSelect }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {leagues.map(l => {
        const active = l.id === activeId
        return (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              active
                ? 'bg-beane-green/10 border-beane-green/40 text-beane-green-text'
                : 'border-surface-line text-ink-secondary hover:border-ink-secondary hover:text-ink-primary'
            }`}
          >
            <span className="font-mono text-[10px] text-ink-muted">
              {SPORT_LABELS[l.config.sport] ?? (l.config.sport ?? 'nba').toUpperCase()}
            </span>
            {l.config.name || 'Unnamed League'}
          </button>
        )
      })}
    </div>
  )
}
