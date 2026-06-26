import { useRef } from 'react'
import { toBlob } from 'html-to-image'

export default function DraftDNACard({ archetype, topCategories = [], boldPrediction, loadingPrediction, onClose }) {
  const cardRef = useRef(null)

  async function handleDownload() {
    if (!cardRef.current) return
    try {
      const blob = await toBlob(cardRef.current, { pixelRatio: 2, backgroundColor: '#0d1117' })
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `draft-dna-${archetype.id}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[DraftDNACard] download failed', err)
    }
  }

  async function handleCopy() {
    const text = `I'm "${archetype.name}" on PocketBeane — check your Draft DNA at pocketbeane.com`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API not available in all contexts
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">

        {/* Card — captured for PNG export */}
        <div
          ref={cardRef}
          className="w-[340px] rounded-2xl p-8 flex flex-col gap-5"
          style={{ background: 'linear-gradient(160deg, #0d1117 0%, #111827 100%)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* PocketBeane wordmark */}
          <p className="text-xs font-mono tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
            PocketBeane
          </p>

          {/* Archetype hero */}
          <div className="space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Your Draft DNA
            </p>
            <h2 className="text-2xl font-bold text-white leading-tight">{archetype.name}</h2>
            <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.55)' }}>
              "{archetype.tagline}"
            </p>
          </div>

          {/* Category edges */}
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

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

          {/* Bold prediction */}
          <div className="pl-3" style={{ borderLeft: '2px solid rgba(34,197,94,0.5)' }}>
            {loadingPrediction ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-green-500/40 border-t-green-400 animate-spin" />
                <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>Generating prediction…</span>
              </div>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {boldPrediction}
              </p>
            )}
          </div>

          {/* Bottom branding */}
          <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            draft smarter at pocketbeane.com
          </p>
        </div>

        {/* Action buttons — outside captured area */}
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-lg text-xs font-mono border border-white/10 text-gray-300 hover:border-white/25 hover:text-white transition-colors"
          >
            Save as Image
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg text-xs font-mono border border-white/10 text-gray-300 hover:border-white/25 hover:text-white transition-colors"
          >
            Copy Link
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono border border-white/10 text-gray-500 hover:text-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
