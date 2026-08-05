import { Card } from '@/components/ui'
import { TIER_STYLES, STANDING_TREND_ARROW } from './shared'

// Persistent right-rail companion to whichever tab is active — same tier/
// trend/strongest-thinnest read the homepage's HeroCard already establishes,
// reused here rather than invented fresh. Exists so switching from This Week
// to Trades to League doesn't cost the user their own standing from working
// memory (D-03 critique: cognitive-load "context switch" finding) and so the
// Season Hub's content actually fills a real grid instead of a single 704px
// column on a 1440px canvas (the No-Uniform-Stack Rule violation D-03 named).
export default function StandingRail({ standing, sportConfig }) {
  const { userEntry, trend } = standing
  if (!userEntry) return null

  const team = userEntry.team
  const tierStyle = TIER_STYLES[userEntry.tier] ?? null
  const trendArrow = trend ? STANDING_TREND_ARROW[trend] : null
  const ranked = sportConfig.categories
    .map(c => ({ label: c.label, rate: userEntry.winRates[c.id]?.rate }))
    .filter(c => c.rate != null)
    .sort((a, b) => b.rate - a.rate)
  const strongest = ranked[0] ?? null
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : null

  return (
    <Card className="lg:sticky lg:top-16">
      <p className="text-label uppercase tracking-[0.08em] text-ink-muted mb-2">Your Standing</p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {tierStyle && (
          <span className={`text-micro font-mono px-2 py-0.5 rounded-full border uppercase ${tierStyle.bg} ${tierStyle.color}`}>
            {tierStyle.label}
          </span>
        )}
        {trendArrow && (
          <span
            role="img"
            aria-label={trendArrow.label}
            title={trendArrow.label}
            className={`text-sm font-mono ${trendArrow.color}`}
          >
            {trendArrow.icon}
          </span>
        )}
      </div>
      <p className="font-display text-title font-medium text-ink-primary mb-2">
        #{team.rank ?? '?'} · {team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ''}
      </p>
      {strongest && (
        <p className="text-xs text-ink-secondary leading-relaxed">
          Strongest in <span className="text-signal-up">{strongest.label}</span>
          {weakest && <> · thinnest in <span className="text-signal-down">{weakest.label}</span></>}
        </p>
      )}
    </Card>
  )
}
