export default function CategoryOutlook({ categoryGaps }) {
  const edges = categoryGaps.filter(g => g.grade === 'strong')
  const solid = categoryGaps.filter(g => g.grade === 'ok')
  const watch = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing')

  return (
    <div className="bg-surface rounded-lg border border-border p-4 space-y-3">
      <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider">Category Outlook</h3>

      {edges.length > 0 && (
        <div>
          <p className="text-xs font-mono text-gray-600 mb-1.5">Projected edges</p>
          <div className="flex flex-wrap gap-1.5">
            {edges.map(g => (
              <span key={g.id} className="text-xs font-mono px-2 py-1 rounded bg-green-500/15 text-green-400 border border-green-500/20">
                {g.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {solid.length > 0 && (
        <div>
          <p className="text-xs font-mono text-gray-600 mb-1.5">Solid contributors</p>
          <div className="flex flex-wrap gap-1.5">
            {solid.map(g => (
              <span key={g.id} className="text-xs font-mono px-2 py-1 rounded bg-yellow-500/10 text-yellow-400/80 border border-yellow-500/20">
                {g.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {watch.length > 0 && (
        <div>
          <p className="text-xs font-mono text-gray-600 mb-1.5">Categories to watch</p>
          <div className="flex flex-wrap gap-1.5">
            {watch.map(g => (
              <span key={g.id} className="text-xs font-mono px-2 py-1 rounded bg-white/5 text-gray-500 border border-border">
                {g.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
