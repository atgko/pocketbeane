import Link from 'next/link'
import { AdvisorCard } from '@/components/ui'
import { STRATEGY_DISPLAY, INJURY_DISPLAY, CATEGORY_DISPLAY } from '@/utils/gmProfile'
import { buildFallbackInsight } from '@/components/season/shared'

// The homepage's personality anchor (D01 brief 4.1). When a weekly H2H
// matchup projection is cached (see shared.jsx's fetchWeeklyMatchup/
// isMatchupStale), this surfaces Claude's real narrative for it — genuine
// commentary, not a generic recap, and it's free: the call already
// happened (fired from here or from Season Hub's This Week tab, shared
// cache either way) rather than firing a new one on every homepage visit,
// which would be an uncapped LLM call outside PMF-01's
// rate-limit-behind-user-action design. Without cached matchup data (no
// GM profile, a Roto league, or an H2H league that hasn't fetched yet)
// this falls back to the deterministic philosophy + standing insight.
export default function BeaneNote({ gmProfile, standing, sportConfig, weeklyMatchup }) {
  if (weeklyMatchup?.outlook) {
    const wins = weeklyMatchup.winCategories?.length ?? 0
    const losses = weeklyMatchup.loseCategories?.length ?? 0
    const tossups = weeklyMatchup.tossupCategories?.length ?? 0
    const title = `You're projected ${wins}-${losses}${tossups ? `-${tossups}` : ''} this week`
    return (
      <AdvisorCard eyebrow="THE MATCHUP READ" title={title}>
        <p>{weeklyMatchup.outlook}</p>
      </AdvisorCard>
    )
  }

  if (!gmProfile?.completedAt) {
    return (
      <AdvisorCard eyebrow="FIRST THINGS FIRST" title="Get to know your GM">
        <p>
          You haven't set a philosophy yet. Take the quick quiz so my calls actually reflect how you draft —
          risk tolerance, category strategy, all of it.
        </p>
        <Link href="/gm-profile" className="inline-block mt-2 text-beane-green-text hover:underline">
          Take the GM Profile quiz →
        </Link>
      </AdvisorCard>
    )
  }

  const strategyLine = `You draft ${STRATEGY_DISPLAY[gmProfile.draftStrategy] ?? 'your own way'} — `
    + `${(INJURY_DISPLAY[gmProfile.injuryTolerance] ?? 'moderate').toLowerCase()} on injury risk, `
    + `${(CATEGORY_DISPLAY[gmProfile.categoryStrategy] ?? 'balanced').toLowerCase()}.`

  const standingLine = standing?.userEntry ? buildFallbackInsight(standing.userEntry, sportConfig) : null

  return (
    <AdvisorCard eyebrow="THE SEASON READ">
      <p>{strategyLine}</p>
      {standingLine && <p className="mt-2">{standingLine}</p>}
    </AdvisorCard>
  )
}
