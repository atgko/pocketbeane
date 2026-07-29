import { Card, Badge } from '@/components/ui'

// Grade → Badge tone, matching the up/watch/down/muted logic used by
// RecommendationPanel's CategoryBar (strong=up, ok=watch, weak=down, missing=neutral/muted).
function toneForGrade(grade) {
  if (grade === 'strong') return 'up'
  if (grade === 'ok') return 'watch'
  if (grade === 'weak') return 'down'
  return 'neutral'
}

export default function CategoryOutlook({ categoryGaps }) {
  const edges = categoryGaps.filter(g => g.grade === 'strong')
  const solid = categoryGaps.filter(g => g.grade === 'ok')
  const watch = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing')

  return (
    <Card variant="data" className="space-y-3">
      <h3 className="text-xs font-mono text-ink-secondary uppercase tracking-wider">Category Outlook</h3>

      {edges.length > 0 && (
        <div>
          <p className="text-xs font-mono text-ink-muted mb-1.5">Projected edges</p>
          <div className="flex flex-wrap gap-1.5">
            {edges.map(g => (
              <Badge key={g.id} tone={toneForGrade(g.grade)} className="font-mono">
                {g.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {solid.length > 0 && (
        <div>
          <p className="text-xs font-mono text-ink-muted mb-1.5">Solid contributors</p>
          <div className="flex flex-wrap gap-1.5">
            {solid.map(g => (
              <Badge key={g.id} tone={toneForGrade(g.grade)} className="font-mono">
                {g.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {watch.length > 0 && (
        <div>
          <p className="text-xs font-mono text-ink-muted mb-1.5">Categories to watch</p>
          <div className="flex flex-wrap gap-1.5">
            {watch.map(g => (
              <Badge key={g.id} tone={toneForGrade(g.grade)} className="font-mono">
                {g.label}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
