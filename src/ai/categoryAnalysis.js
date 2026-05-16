import { computeCategoryTotals } from '@/utils/roster'

// Returns enriched category objects with current value, benchmark, progress ratio, and grade.
// rosterProgress is used to scale counting-stat benchmarks mid-draft.
export function analyzeCategoryGaps(userPicks, playerMap, sportConfig, totalRosterSlots) {
  const { categories, percentageCategories, benchmarks } = sportConfig
  const pctSet = new Set(percentageCategories)
  const totals = computeCategoryTotals(userPicks, playerMap, categories, percentageCategories)
  const rosterProgress = userPicks.length / totalRosterSlots

  return categories.map(cat => {
    const current = totals?.[cat.id] ?? null
    const benchmark = benchmarks[cat.id]
    const isTO = cat.id === 'to'
    const isPct = pctSet.has(cat.id)

    if (current == null || rosterProgress === 0) {
      return { ...cat, current, benchmark, progress: 0, grade: 'missing' }
    }

    let progress
    if (isPct) {
      // Percentage stats compare directly (no scaling by roster count)
      progress = current / benchmark
    } else if (isTO) {
      // Turnovers: lower is better — progress > 1 means fewer TOs than pace, which is good
      const scaledBenchmark = benchmark * rosterProgress
      progress = scaledBenchmark / current
    } else {
      progress = current / (benchmark * rosterProgress)
    }

    let grade
    if (progress >= 1.15) grade = 'strong'
    else if (progress >= 0.85) grade = 'ok'
    else grade = 'weak'

    return { ...cat, current, benchmark, progress, grade }
  })
}
