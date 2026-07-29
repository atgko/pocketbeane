export default function TabBar({ tabs, active, onChange, className = '' }) {
  // tabs: [{ key: 'this-week', label: 'This Week' }, ...]
  return (
    <div role="tablist" className={`flex gap-1 border-b border-surface-line ${className}`}>
      {tabs.map(t => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors
            ${active === t.key
              ? 'text-ink-primary border-beane-green'
              : 'text-ink-secondary border-transparent hover:text-ink-primary'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
