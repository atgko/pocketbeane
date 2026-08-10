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

// Points-mode equivalent of analyzeCategoryGaps, for leagues where
// scoringFormat === 'points' (see documentation/BACKLOG.md NFL-01 / memory
// project_sleeper_integration_scope — Yahoo NFL stays on the single-
// synthetic-category fantasy_ppg shim, this is the real alternative used
// for Sleeper). Category-gap grading doesn't mean anything for a points
// league; positional roster construction is the equivalent "is this team
// balanced" signal, so this returns objects shaped identically to
// analyzeCategoryGaps's output ({id, label, current, benchmark, progress,
// grade}) — every downstream consumer (rankByFitPoints, classifyDraftDNA's
// strongCats/weakCats counting, recommend.js's prompt building, the
// Zone-3 category bars in RecommendationPanel.jsx / DraftRecap.jsx) reads
// these fields generically and needs zero further changes.
//
// `rosterSlots` is the league's actual slot list (league.rosterSlots —
// [{type, playerId}]), not sportConfig's default — a user-customized slot
// count should drive "how many starters at this position does this team
// need," same as analyzeCategoryGaps scales benchmarks by the team's own
// totalRosterSlots rather than a hardcoded number.
const NON_STARTING_SLOT_TYPES = new Set(['BN', 'IL', 'IL+'])

export function analyzePositionalNeeds(userPicks, playerMap, rosterSlots) {
  const required = {}
  for (const slot of rosterSlots) {
    if (NON_STARTING_SLOT_TYPES.has(slot.type)) continue
    required[slot.type] = (required[slot.type] ?? 0) + 1
  }

  const filled = {}
  for (const pick of userPicks) {
    const player = playerMap[pick.playerId]
    const pos = player?.positions?.[0] ?? player?.yahoo_positions?.[0]
    if (!pos || !(pos in required)) continue
    filled[pos] = (filled[pos] ?? 0) + 1
  }

  return Object.entries(required).map(([position, req]) => {
    const have = filled[position] ?? 0
    const progress = req > 0 ? have / req : 1

    let grade
    if (have === 0) grade = 'missing'
    else if (have >= req) grade = 'strong'
    else if (have >= req * 0.5) grade = 'ok'
    else grade = 'weak'

    return {
      id: position,
      label: position,
      description: `${position} roster need`,
      current: have,
      benchmark: req,
      progress,
      grade,
    }
  })
}
