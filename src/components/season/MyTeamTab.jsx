import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import nflPlayers from '@/data/nfl_players.json'
import { getWinRateGrade } from '@/utils/teamStanding'
import { Card, Badge } from '@/components/ui'
import { TrendBadge, WIN_RATE_GRADE_STYLES, WIN_RATE_BAR_COLOR, findPlayerByName, useTeamStanding } from './shared'

// The one large, confident brass moment this screen earns — My Team had
// zero brass before D-04 (Brass Scarcity Rule caps it at ≤3/screen, but
// this tab was sitting at the opposite failure: none at all). Only renders
// when a category is a genuine 'strong' grade (>=70% league win rate,
// tightened alongside the Value-column fix) — no category clearing that
// bar means no fabricated edge, matching the product's fail-soft principle.
function EdgeCallout({ cat, winRate }) {
  if (!cat || !winRate) return null
  return (
    <div className="flex items-center gap-4 rounded-xl border border-brass/25 bg-brass/[0.06] px-4 py-3 mb-4">
      <span className="font-mono text-data-lg font-semibold text-brass tabular-nums shrink-0">
        {Math.round(winRate.rate * 100)}%
      </span>
      <p className="text-xs text-ink-secondary leading-relaxed">
        <Badge tone="brass" size="sm" className="mr-1.5 align-middle">Your Edge</Badge>
        <span className="text-ink-primary font-medium">{cat.label}</span> is your strongest category — beating {winRate.wins} of {winRate.of} other teams.
      </p>
    </div>
  )
}

function WinRateRow({ cat, winRate }) {
  const grade = getWinRateGrade(winRate?.rate ?? null)
  const barPct = winRate?.rate != null ? Math.round(winRate.rate * 100) : 0
  const gradeStyle = grade ? WIN_RATE_GRADE_STYLES[grade] : 'text-ink-muted bg-surface-overlay border-surface-line'
  const barColor = grade ? WIN_RATE_BAR_COLOR[grade] : 'bg-ink-muted/30'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-ink-secondary w-10 shrink-0">{cat.label}</span>
      <div className="flex-1 bg-surface-overlay rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
      </div>
      <span className="text-xs font-mono tabular-nums text-ink-secondary w-10 text-right">
        {winRate?.rate != null ? `${barPct}%` : '—'}
      </span>
      <span className={`text-micro font-mono px-1.5 py-0.5 rounded-full border w-14 text-center shrink-0 ${gradeStyle}`}>
        {grade ?? 'n/a'}
      </span>
    </div>
  )
}

function RosterRow({ entry, player }) {
  const hurt = entry.status && entry.status !== 'active'
  return (
    <div className="flex items-center justify-between gap-3 border border-surface-line rounded-md px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-ink-primary font-medium truncate">{entry.name}</span>
        {entry.positions && (
          <span className="text-micro font-mono text-ink-muted shrink-0">{entry.positions}</span>
        )}
        <TrendBadge player={player} />
      </div>
      {hurt && (
        <span className="shrink-0 text-micro font-mono px-1.5 py-0.5 rounded-full bg-signal-watch/15 text-signal-watch uppercase">
          {entry.status}
        </span>
      )}
    </div>
  )
}

// My Team tab — synced roster, injury badges, trend arrows, category profile
// bars, per the brief's 4.2 tab breakdown. Entirely deterministic (no LLM
// call), built from the same win-rate math the League tab uses.
export default function MyTeamTab({ league, rosters }) {
  const sport = league.config.sport ?? 'nba'
  const players = sport === 'mlb' ? mlbPlayers : sport === 'nfl' ? nflPlayers : nbaPlayers
  const { userEntry, sportConfig } = useTeamStanding({ league, rosters, players })

  if (!userEntry) return null

  const userTeam = userEntry.team
  const playerById = Object.fromEntries(players.map(p => [p.id, p]))
  const resolvePlayer = (entry) => (entry.playerId && playerById[entry.playerId]) || findPlayerByName(players, entry.name)

  const edge = sportConfig.categories
    .map(cat => ({ cat, winRate: userEntry.winRates[cat.id] }))
    .filter(({ winRate }) => getWinRateGrade(winRate?.rate ?? null) === 'strong')
    .sort((a, b) => b.winRate.rate - a.winRate.rate)[0] ?? null

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-display text-heading font-medium text-ink-primary">{userTeam.teamName}</h3>
          <span className="text-micro font-mono tabular-nums text-ink-secondary">
            #{userTeam.rank ?? '?'} · {userTeam.wins}-{userTeam.losses}{userTeam.ties ? `-${userTeam.ties}` : ''}
          </span>
        </div>
        {edge && <EdgeCallout cat={edge.cat} winRate={edge.winRate} />}
        <p className="text-micro font-mono text-ink-muted uppercase tracking-wider mb-2">Category Profile</p>
        <div className="space-y-1.5">
          {sportConfig.categories.map(cat => (
            <WinRateRow key={cat.id} cat={cat} winRate={userEntry.winRates[cat.id]} />
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-micro font-mono text-ink-muted uppercase tracking-wider mb-3">Roster</p>
        <div className="space-y-1.5">
          {userTeam.roster.map((entry, i) => (
            <RosterRow key={entry.playerKey ?? i} entry={entry} player={resolvePlayer(entry)} />
          ))}
        </div>
      </Card>
    </div>
  )
}
