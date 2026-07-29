import Link from 'next/link'
import { AdvisorCard } from '@/components/ui'
import { STRATEGY_DISPLAY, INJURY_DISPLAY, CATEGORY_DISPLAY } from '@/utils/gmProfile'
import { buildFallbackInsight } from '@/components/season/shared'

// The homepage's personality anchor (D01 brief 4.1) — deterministic on
// purpose: a live Claude call firing on every homepage visit would be an
// uncapped LLM call outside PMF-01's rate-limit-behind-user-action design.
// Built from data already on the page: the GM profile quiz answers, plus
// the hero league's standing (reusing the same fallback-insight sentence
// the League tab uses when Claude hasn't weighed in for that team either).
export default function BeaneNote({ gmProfile, standing, sportConfig }) {
  if (!gmProfile?.completedAt) {
    return (
      <AdvisorCard title="Get to know your GM">
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
    <AdvisorCard>
      <p>{strategyLine}</p>
      {standingLine && <p className="mt-2">{standingLine}</p>}
    </AdvisorCard>
  )
}
