import { useState } from 'react'

export default function DraftDNACard({ archetype, topCategories = [], boldPrediction, loadingPrediction, onClose }) {
  const [copied, setCopied] = useState(false)

  const shareText = `${archetype.name}: "${archetype.tagline}"${boldPrediction ? `\n\n${boldPrediction}` : ''}`

  const canShare = typeof window !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare({ title: archetype.name, text: shareText, url: 'https://pocketbeane.com' }))

  function handleShare() {
    navigator.share({
      title: archetype.name,
      text: shareText,
      url: 'https://pocketbeane.com',
    }).catch(() => {})
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\nhttps://pocketbeane.com`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">

        {/* Card */}
        <div
          className="w-[340px] rounded-2xl p-8 flex flex-col gap-5"
          style={{ background: 'linear-gradient(160deg, #0d1117 0%, #111827 100%)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs font-mono tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
            PocketBeane
          </p>

          <div className="space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Your Draft DNA
            </p>
            <h2 className="text-2xl font-bold text-ink-primary leading-tight">{archetype.name}</h2>
            <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.55)' }}>
              "{archetype.tagline}"
            </p>
          </div>

          {topCategories.length > 0 && (
            <div>
              <p className="text-xs font-mono mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Category edges</p>
              <div className="flex flex-wrap gap-1.5">
                {topCategories.map(cat => (
                  <span
                    key={cat}
                    className="text-xs font-mono px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.15)', color: 'rgb(134,239,172)', border: '1px solid rgba(34,197,94,0.25)' }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

          <div className="pl-3" style={{ borderLeft: '2px solid rgba(34,197,94,0.5)' }}>
            {loadingPrediction ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-signal-up/40 border-t-signal-up animate-spin" />
                <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>Generating prediction…</span>
              </div>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {boldPrediction}
              </p>
            )}
          </div>

          <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            draft smarter at pocketbeane.com
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {canShare && (
            <button
              onClick={handleShare}
              className="px-4 py-2 rounded-lg text-xs font-mono bg-beane-green/10 border border-beane-green/30 text-beane-green-text hover:bg-beane-green/20 transition-colors"
            >
              Share your Draft DNA
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg text-xs font-mono border border-surface-line text-ink-secondary hover:border-surface-overlay hover:text-ink-primary transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono border border-surface-line text-ink-muted hover:text-ink-secondary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
