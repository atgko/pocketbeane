const TONES = {
  up: 'bg-signal-up/15 text-signal-up',
  down: 'bg-signal-down/15 text-signal-down',
  watch: 'bg-signal-watch/15 text-signal-watch',
  info: 'bg-signal-info/15 text-signal-info',
  brass: 'bg-brass/[.12] text-brass border border-brass/[.35]',
  neutral: 'bg-surface-overlay text-ink-secondary',
}

// 'sm' is for dense rows/tables (draft board, season hub panels) where the
// default pill is visually too large next to compact data — same tones,
// smaller footprint.
const SIZES = {
  default: 'px-2.5 py-[3px] text-label',
  sm: 'px-2 py-[1px] text-[10px]',
}

export default function Badge({ tone = 'neutral', size = 'default', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${SIZES[size]} ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}
