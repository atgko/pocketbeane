// Shared error presentation for advisor panels — replaces the app-wide
// pattern of rendering a raw fetch/exception message directly. Plain
// language + a retry action wired to whatever handler already fetches,
// since every advisor already has one. Beane's voice shouldn't break into
// an API error the moment something goes wrong server-side.
export default function AdvisorError({ message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 mt-4">
      <p className="text-xs text-signal-down leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-xs font-mono px-3 py-1.5 border border-signal-down/30 text-signal-down rounded-lg hover:bg-signal-down/10 transition-colors"
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
