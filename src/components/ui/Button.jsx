const VARIANTS = {
  primary: 'bg-beane-green text-[#06120C] font-semibold hover:brightness-110',
  secondary: 'bg-transparent border border-surface-line text-ink-primary font-medium hover:bg-surface-overlay',
  destructive: 'bg-transparent border border-signal-down text-signal-down font-medium hover:bg-signal-down/10',
}

export default function Button({ variant = 'primary', className = '', children, ...rest }) {
  return (
    <button
      className={`rounded-lg px-[18px] py-2.5 text-[13.5px] transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beane-green/60
        focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
        disabled:opacity-40 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
