import Card from './Card'

export default function AdvisorCard({ eyebrow = "BEANE'S TAKE", title, children, footer, className = '' }) {
  return (
    <Card variant="advisor" className={className}>
      <p className="text-label uppercase tracking-[0.08em] font-semibold text-brass">{eyebrow}</p>
      {title && (
        <h3 className="font-display text-heading font-medium mt-2 mb-1.5">{title}</h3>
      )}
      <div className="text-body text-ink-secondary [&_strong]:text-ink-primary [&_strong]:font-medium">
        {children}
      </div>
      {footer && (
        <div className="mt-3.5 pt-3 border-t border-surface-line">{footer}</div>
      )}
    </Card>
  )
}
