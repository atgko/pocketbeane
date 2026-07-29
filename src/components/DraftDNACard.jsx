import { useState } from 'react'
import { Card, Badge, Button, ArchetypeGlyph } from '@/components/ui'

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
      <div className="flex flex-col items-center gap-5">

        <Card variant="identity" className="relative w-[340px] max-w-[calc(100vw-2rem)] min-h-[425px] overflow-hidden flex flex-col">
          {/* Barely-there radial brass glow, top-center */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-48"
            style={{ background: 'radial-gradient(ellipse at top, rgb(var(--color-brass) / 0.16), transparent 70%)' }}
          />

          <div className="relative flex items-baseline justify-center gap-2">
            <p className="text-label uppercase tracking-[0.15em] text-ink-muted">PocketBeane</p>
            <span className="text-ink-muted/40">·</span>
            <p className="text-label uppercase tracking-[0.1em] text-ink-muted/70">Draft DNA</p>
          </div>

          <div className="relative flex-1 flex flex-col items-center justify-center gap-3.5 py-3">
            <ArchetypeGlyph id={archetype.id} className="w-11 h-11 text-brass" />

            <div className="space-y-2">
              <h2 className="font-display text-display font-semibold text-ink-primary leading-[1.1]">
                {archetype.name}
              </h2>
              <p className="text-body italic text-ink-secondary">"{archetype.tagline}"</p>
            </div>

            {topCategories.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {topCategories.map(cat => (
                  <Badge key={cat} tone="brass">{cat}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="relative border-t border-surface-line pt-4">
            {loadingPrediction ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full border border-brass/40 border-t-brass animate-spin" />
                <span className="text-label text-ink-muted">Generating prediction…</span>
              </div>
            ) : (
              <p className="text-body text-ink-primary/90 leading-relaxed text-center">
                {boldPrediction}
              </p>
            )}
          </div>

          <p className="relative text-label uppercase tracking-[0.1em] text-ink-muted text-center pt-4">
            pocketbeane.app
          </p>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-2 max-w-[340px]">
          {canShare && (
            <Button variant="primary" onClick={handleShare}>
              Share your Draft DNA
            </Button>
          )}
          <Button variant="secondary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
