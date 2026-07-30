import { Card, Button } from '@/components/ui'
import { TIER_STYLES, STANDING_TREND_ARROW, isH2HLeague } from '@/components/season/shared'

// 'Draft in N days' from an optional config.draftDate — silent (no stale
// negative countdown) once the date has passed, since the league's status
// will have moved on by then anyway.
function getDraftCountdown(draftDate) {
  if (!draftDate) return null
  const target = new Date(`${draftDate}T00:00:00`)
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((target - todayMidnight) / (24 * 60 * 60 * 1000))
  if (days > 1) return `Draft in ${days} days`
  if (days === 1) return 'Draft is tomorrow'
  if (days === 0) return 'Draft is today'
  return null
}

function ChecklistItem({ label, done }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm ${done ? 'text-signal-up' : 'text-ink-muted'}`}>{done ? '✓' : '○'}</span>
      <span className={`text-xs ${done ? 'text-ink-secondary' : 'text-ink-muted'}`}>{label}</span>
    </div>
  )
}

function HeroShell({ eyebrow, headline, children, action }) {
  return (
    <Card className="h-full flex flex-col">
      <p className="text-label uppercase tracking-[0.08em] text-ink-muted mb-2">{eyebrow}</p>
      <h2 className="font-display text-title font-medium text-ink-primary mb-3">{headline}</h2>
      <div className="flex-1 space-y-3">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}

const CAT_SEGMENT_STYLES = {
  win:    'bg-signal-up/[.16] text-signal-up',
  lose:   'bg-signal-down/[.13] text-signal-down',
  tossup: 'bg-surface-overlay text-ink-secondary',
}
const CAT_SEGMENT_SYMBOL = { win: 'W', lose: 'L', tossup: '—' }

// 9-segment win/lose/tossup bar (D01 mockup, homepage hero) — Claude's
// matchup call returns category labels, not internal category ids, so
// matching is label-first with id as a fallback.
function MatchupCategoryBar({ sportConfig, winCategories = [], loseCategories = [] }) {
  const resultFor = (cat) => {
    if (winCategories.includes(cat.label) || winCategories.includes(cat.id)) return 'win'
    if (loseCategories.includes(cat.label) || loseCategories.includes(cat.id)) return 'lose'
    return 'tossup'
  }
  return (
    <div className="flex gap-1">
      {sportConfig.categories.map(cat => {
        const result = resultFor(cat)
        return (
          <div
            key={cat.id}
            className={`flex-1 h-9 rounded-md flex flex-col items-center justify-center font-mono text-micro font-semibold ${CAT_SEGMENT_STYLES[result]}`}
          >
            {cat.label}
            <span className="text-micro font-medium opacity-75">{CAT_SEGMENT_SYMBOL[result]}</span>
          </div>
        )
      })}
    </div>
  )
}

// Calendar-aware hero status card (D01 brief 4.1) — the one thing on the
// homepage that answers "what needs my attention" without clicking anything.
// The in-season state uses deterministic standing math (tier/record/trend),
// not a live matchup pull — an automatic Claude call on every homepage visit
// would fight PMF-01's rate-limit-behind-user-action design.
export default function HeroCard({ league, rosters, standing, sportConfig, weeklyMatchup, matchupLoading, yahooConnected, philosophySet, onEnterDraft, onEnterSeason }) {
  const { config, status, draft } = league
  const pickCount = draft.picks.length
  const isDrafting = status === 'drafting'

  if (isDrafting && pickCount === 0) {
    const countdown = getDraftCountdown(config.draftDate)
    const yahooLinked = yahooConnected && Boolean(config.yahooLeagueKey)
    return (
      <HeroShell
        eyebrow={config.name || 'Upcoming Draft'}
        headline={countdown ?? 'Draft not yet scheduled'}
        action={<Button variant="primary" onClick={() => onEnterDraft(league.id)}>Go to Draft Board</Button>}
      >
        <ChecklistItem label="Player pool refreshed" done />
        <ChecklistItem label="Philosophy set" done={philosophySet} />
        <ChecklistItem label="Yahoo linked" done={yahooLinked} />
      </HeroShell>
    )
  }

  if (isDrafting && pickCount > 0) {
    const round = Math.ceil(pickCount / config.numTeams)
    return (
      <HeroShell
        eyebrow={config.name || 'Draft'}
        headline="Draft in progress"
        action={<Button variant="primary" onClick={() => onEnterDraft(league.id)}>Resume Draft</Button>}
      >
        <p className="text-xs text-ink-secondary font-mono tabular-nums">
          Round {round} · Pick {pickCount + 1}
        </p>
      </HeroShell>
    )
  }

  if (status === 'complete') {
    const recap = league.seasonRecap
    return (
      <HeroShell
        eyebrow={config.name || 'Archived'}
        headline={recap ? `Finished #${recap.rank ?? '?'} of ${recap.numTeams}` : 'Season archived'}
        action={<Button variant="secondary" onClick={() => onEnterSeason(league.id)}>View Season Hub</Button>}
      >
        {recap?.headline ? (
          <p className="text-xs text-ink-secondary italic leading-relaxed">{recap.headline}</p>
        ) : (
          <p className="text-xs text-ink-muted">This league's season has concluded.</p>
        )}
      </HeroShell>
    )
  }

  // status === 'season'
  if (!rosters?.teams?.length) {
    return (
      <HeroShell
        eyebrow={config.name || 'Season'}
        headline="Sync your rosters to see where you stand"
        action={<Button variant="primary" onClick={() => onEnterSeason(league.id)}>Go to Season Hub</Button>}
      >
        <p className="text-xs text-ink-muted">No roster snapshot yet for this league.</p>
      </HeroShell>
    )
  }

  const { userEntry, trend } = standing ?? {}

  // H2H leagues with a real matchup projection cached get the mockup's
  // opponent + category-bar format — the richer, more specific surface.
  // Roto leagues (no weekly opponent exists) and H2H leagues still
  // fetching/without a cached projection yet fall back to the
  // deterministic standings hero below.
  if (isH2HLeague(league) && weeklyMatchup) {
    return (
      <HeroShell
        eyebrow={`Week ${weeklyMatchup.week} Matchup · ${config.name || 'Your League'}`}
        headline={`You vs. ${weeklyMatchup.opponent}`}
        action={<Button variant="primary" onClick={() => onEnterSeason(league.id)}>Open This Week</Button>}
      >
        <p className="text-xs text-ink-secondary">Projected category split for this week</p>
        <MatchupCategoryBar
          sportConfig={sportConfig}
          winCategories={weeklyMatchup.winCategories}
          loseCategories={weeklyMatchup.loseCategories}
        />
        {/* Full narrative lives in Beane's Note alongside this card — the
            short action item is the only text worth repeating here too. */}
        {weeklyMatchup.keyNote && (
          <p className="text-xs text-ink-muted leading-relaxed">{weeklyMatchup.keyNote}</p>
        )}
      </HeroShell>
    )
  }

  if (!userEntry) {
    return (
      <HeroShell
        eyebrow={config.name || 'Season'}
        headline="Standing unavailable"
        action={<Button variant="primary" onClick={() => onEnterSeason(league.id)}>Go to Season Hub</Button>}
      >
        <p className="text-xs text-ink-muted">Your team wasn't found in the last synced roster snapshot.</p>
      </HeroShell>
    )
  }

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
    <HeroShell
      eyebrow={config.name || 'Season'}
      headline={`#${team.rank ?? '?'} · ${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ''}`}
      action={<Button variant="primary" onClick={() => onEnterSeason(league.id)}>Go to Season Hub</Button>}
    >
      <div className="flex flex-wrap items-center gap-2">
        {tierStyle && (
          <span className={`text-micro font-mono px-2 py-0.5 rounded-full border uppercase ${tierStyle.bg} ${tierStyle.color}`}>
            {tierStyle.label}
          </span>
        )}
        {trendArrow && <span className={`text-sm font-mono ${trendArrow.color}`}>{trendArrow.icon}</span>}
      </div>
      {strongest && (
        <p className="text-xs text-ink-secondary leading-relaxed">
          Strongest in <span className="text-signal-up">{strongest.label}</span>
          {weakest && <> · thinnest in <span className="text-signal-down">{weakest.label}</span></>}
        </p>
      )}
      {isH2HLeague(league) && matchupLoading && (
        <p className="text-xs font-mono text-ink-muted animate-pulse">Pulling this week's matchup…</p>
      )}
    </HeroShell>
  )
}
