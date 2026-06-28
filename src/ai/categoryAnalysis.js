import { computeCategoryTotals } from '@/utils/roster'

// Returns enriched category objects with current value, benchmark, progress ratio, and grade.
// rosterProgress is used to scale counting-stat benchmarks mid-draft.
export function analyzeCategoryGaps(userPicks, playerMap, sportConfig, totalRosterSlots) {
  const { categories, percentageCategories, benchmarks } = sportConfig
  const pctSet = new Set(percentageCategories)
  const lowerBetterSet = new Set(sportConfig.lowerIsBetter ?? [])
  const totals = computeCategoryTotals(userPicks, playerMap, categories, percentageCategories)
  const rosterProgress = userPicks.length / totalRosterSlots

  return categories.map(cat => {
    const current = totals?.[cat.id] ?? null
    const benchmark = benchmarks[cat.id]
    const isLowerBetter = lowerBetterSet.has(cat.id)
    const isPct = pctSet.has(cat.id)

    if (current == null || rosterProgress === 0) {
      return { ...cat, current, benchmark, progress: 0, grade: 'missing' }
    }

    let progress
    if (isPct) {
      // Rate stats (avg, fg_pct, era, whip): compare directly, no roster scaling
      progress = isLowerBetter ? benchmark / current : current / benchmark
    } else if (isLowerBetter) {
      // Counting stat, lower is better (e.g. turnovers)
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
