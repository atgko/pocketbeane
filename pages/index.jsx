import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import useLeagueStore from '@/store/leagueStore'
import { useYahooAuth } from '@/hooks/useYahooAuth'
import nbaPlayers from '@/data/players.json'
import mlbPlayers from '@/data/mlb_players.json'
import { getSportConfig } from '@/config/sports'
import { getGMProfile } from '@/utils/gmProfile'
import { Card } from '@/components/ui'
import { computeTeamStanding, TIER_STYLES, STANDING_TREND_ARROW, isH2HLeague, isMatchupStale, fetchWeeklyMatchup } from '@/components/season/shared'
import HeroCard from '@/components/home/HeroCard'
import BeaneNote from '@/components/home/BeaneNote'
import LeagueSwitcher from '@/components/home/LeagueSwitcher'

const STATUS_LABEL = { drafting: 'In Draft', complete: 'Archived', season: 'Season' }
const STATUS_COLOR = { drafting: 'text-beane-green-text', complete: 'text-ink-muted', season: 'text-signal-info' }

const SPORT_ORDER = ['nba', 'mlb']
const SPORT_LABELS = { nba: 'NBA', mlb: 'MLB' }

function getLeagueYear(league) {
  if (league.config.yahooSeason) return Number(league.config.yahooSeason)
  const ts = parseInt(league.id.split('-')[1])
  return isNaN(ts) ? null : new Date(ts).getFullYear()
}

function formatSeasonYear(year, sport) {
  if (!year) return 'Unknown'
  if (sport === 'nba') return `${year - 1}–${String(year).slice(-2)}`
  return String(year)
}

function playersFor(sport) {
  return sport === 'mlb' ? mlbPlayers : nbaPlayers
}

// Which league's Hero/Beane's Note shows by default. An upcoming draft
// (no picks yet) is the one thing worth a proactive reminder, so it wins
// outright. Below that, an active season league — your actual ongoing
// weekly responsibility — outranks a 'drafting' league that already has
// picks: that state is either a live draft you're already sitting at (so
// seeing it on the homepage adds nothing) or a stale/abandoned one, and
// either way it shouldn't silently bury a season you're supposed to be
// managing.
function pickHeroLeagueId(leagues) {
  const candidates = leagues.filter(l => l.status !== 'complete')
  const pool = candidates.length > 0 ? candidates : leagues
  if (pool.length === 0) return null
  const urgency = (l) => {
    if (l.status === 'drafting') return l.draft.picks.length === 0 ? 3 : 1
    if (l.status === 'season') return 2
    return 0
  }
  return [...pool].sort((a, b) => urgency(b) - urgency(a))[0].id
}

export default function Home() {
  const router = useRouter()
  const { leagues, setActiveLeague, deleteLeague, setLeagueStatus, archiveLeague, setWeeklyMatchup } = useLeagueStore()
  const [mounted, setMounted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [yahooToast, setYahooToast] = useState(null)
  const [selectedHeroId, setSelectedHeroId] = useState(null)
  const yahoo = useYahooAuth()

  useEffect(() => { setMounted(true) }, [])

  // Auto-archive season leagues inactive for 7+ days (last roster sync)
  useEffect(() => {
    if (!mounted) return
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
    for (const l of leagues) {
      if (l.status !== 'season') continue
      const syncedAt = l.leagueRosters?.syncedAt
      if (!syncedAt) continue
      if (Date.now() - new Date(syncedAt).getTime() > SEVEN_DAYS) {
        archiveLeague(l.id)
      }
    }
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const { yahoo_connected, yahoo_error } = router.query
    if (yahoo_connected) {
      setYahooToast({ type: 'success', message: 'Yahoo account connected.' })
      router.replace('/', undefined, { shallow: true })
    } else if (yahoo_error) {
      setYahooToast({ type: 'error', message: `Yahoo error: ${yahoo_error}` })
      router.replace('/', undefined, { shallow: true })
    }
  }, [mounted, router.query])

  const gmProfile = mounted ? getGMProfile() : null
  const philosophySet = Boolean(gmProfile?.completedAt)

  const nonArchivedLeagues = useMemo(() => leagues.filter(l => l.status !== 'complete'), [leagues])
  const defaultHeroId = useMemo(() => pickHeroLeagueId(leagues), [leagues])
  const heroLeagueId = selectedHeroId ?? defaultHeroId
  const heroLeague = leagues.find(l => l.id === heroLeagueId) ?? null

  const heroStanding = useMemo(() => {
    if (!heroLeague || heroLeague.status !== 'season') return null
    const rosters = heroLeague.leagueRosters
    if (!rosters?.teams?.length) return null
    const sportConfig = getSportConfig(heroLeague.config.sport ?? 'nba')
    return computeTeamStanding({ league: heroLeague, rosters, players: playersFor(heroLeague.config.sport ?? 'nba'), sportConfig })
  }, [heroLeague])
  const heroSportConfig = heroLeague ? getSportConfig(heroLeague.config.sport ?? 'nba') : null

  // Weekly matchup projection for the hero — H2H leagues only, and only
  // when the shared cache (also written to by Season Hub's This Week tab)
  // is missing or past the most recent Monday. One fetch per stale week,
  // not one per homepage visit.
  const [matchupLoading, setMatchupLoading] = useState(false)
  const matchupFetchingRef = useRef(null)
  useEffect(() => {
    if (!heroLeague || heroLeague.status !== 'season') return
    if (!isH2HLeague(heroLeague)) return
    if (!yahoo.connected || !heroLeague.config.yahooLeagueKey) return
    if (!heroLeague.leagueRosters?.teams?.length) return
    if (!isMatchupStale(heroLeague.weeklyMatchup)) return
    if (matchupFetchingRef.current === heroLeague.id) return

    matchupFetchingRef.current = heroLeague.id
    setMatchupLoading(true)
    fetchWeeklyMatchup({ league: heroLeague, rosters: heroLeague.leagueRosters })
      .then(data => setWeeklyMatchup(heroLeague.id, data))
      .catch(() => {}) // silent on homepage — Season Hub's This Week tab surfaces the real error on demand
      .finally(() => {
        matchupFetchingRef.current = null
        setMatchupLoading(false)
      })
  }, [heroLeague?.id, heroLeague?.weeklyMatchup, yahoo.connected])

  if (!mounted) return null

  const handleEnterDraft = (id) => {
    setActiveLeague(id)
    router.push('/draft')
  }

  const handleEnterSeason = (id) => {
    setActiveLeague(id)
    // Only auto-promote into 'season' status from an earlier stage (e.g.
    // right after a draft syncs) — an already-archived ('complete') league
    // must stay archived just from being viewed, or every visit to a
    // concluded league's Season Hub would silently un-archive it.
    const league = leagues.find(l => l.id === id)
    if (league?.status !== 'complete') {
      setLeagueStatus(id, 'season')
    }
    router.push('/season')
  }

  const handleDelete = (id) => {
    if (confirmDelete === id) {
      deleteLeague(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
    }
  }

  // Group leagues by sport, split active vs archived within each sport
  const grouped = {}
  for (const l of leagues) {
    const sport = l.config.sport ?? 'nba'
    if (!grouped[sport]) grouped[sport] = { active: [], archived: [] }
    if (l.status === 'complete') {
      grouped[sport].archived.push(l)
    } else {
      grouped[sport].active.push(l)
    }
  }

  const sportGroups = [
    ...SPORT_ORDER.filter(s => grouped[s]),
    ...Object.keys(grouped).filter(s => !SPORT_ORDER.includes(s)),
  ].map(s => ({ sport: s, ...grouped[s] }))

  const hasMultipleSports = sportGroups.length > 1

  const sharedCardProps = {
    yahooConnected: yahoo.connected,
    onEnterDraft: handleEnterDraft,
    onEnterSeason: handleEnterSeason,
    onEdit: (id) => router.push(`/setup?id=${id}`),
    onDelete: handleDelete,
    onCancelDelete: () => setConfirmDelete(null),
    confirmDelete,
    archiveLeague,
    onUnarchive: (id) => setLeagueStatus(id, 'season'),
  }

  return (
    <>
      <Head>
        <title>PocketBeane</title>
        <meta name="description" content="AI-powered Assistant GM for fantasy basketball" />
      </Head>
      <main className="min-h-screen bg-surface-base text-ink-primary">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">

          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-ink-primary tracking-tight">PocketBeane</h1>
              <p className="text-ink-secondary mt-1 text-sm">AI-powered Assistant GM</p>
            </div>

            {nonArchivedLeagues.length > 0 && (
              <LeagueSwitcher
                leagues={nonArchivedLeagues}
                activeId={heroLeagueId}
                onSelect={setSelectedHeroId}
              />
            )}

            <div className="flex items-center gap-3">
              {yahoo.connected && (
                <button
                  onClick={yahoo.disconnect}
                  title="Disconnect Yahoo"
                  className="group flex items-center gap-1.5 text-xs font-mono text-ink-secondary hover:text-signal-down transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-beane-green group-hover:bg-signal-down transition-colors" />
                  {yahoo.screenName ?? 'Yahoo connected'}
                </button>
              )}
              <Link
                href="/gm-profile"
                className="text-xs text-ink-secondary hover:text-ink-primary transition-colors font-mono"
                title="GM Profile"
              >
                GM Profile
              </Link>
              {leagues.length > 0 && (
                <Link
                  href="/setup"
                  className="px-4 py-2 bg-beane-green text-[#06120C] rounded-lg text-sm font-semibold hover:brightness-110 transition-colors"
                >
                  + New League
                </Link>
              )}
            </div>
          </div>

          {/* Yahoo connect CTA — only shown while disconnected; once connected
              the top-bar status pill above covers it */}
          {!yahoo.connected && <YahooConnect yahoo={yahoo} />}

          {/* Toast */}
          {yahooToast && (
            <div className={`mb-6 px-4 py-3 rounded-lg text-sm flex items-center justify-between ${yahooToast.type === 'success' ? 'bg-signal-up/15 border border-signal-up/40 text-signal-up' : 'bg-signal-down/15 border border-signal-down/40 text-signal-down'}`}>
              <span>{yahooToast.message}</span>
              <button onClick={() => setYahooToast(null)} className="ml-4 text-ink-secondary hover:text-ink-primary">✕</button>
            </div>
          )}

          {leagues.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Active league quick actions — scoped to whichever league
                  the Hero/Beane's Note below is currently showing */}
              {heroLeague && heroLeague.status !== 'complete' && (
                <ActiveLeagueBar
                  league={heroLeague}
                  confirmingDelete={confirmDelete === heroLeague.id}
                  {...sharedCardProps}
                />
              )}

              {/* Hero status + Beane's Note */}
              {heroLeague && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
                  <div className="lg:col-span-8">
                    <HeroCard
                      league={heroLeague}
                      rosters={heroLeague.leagueRosters ?? null}
                      standing={heroStanding}
                      sportConfig={heroSportConfig}
                      weeklyMatchup={!isMatchupStale(heroLeague.weeklyMatchup) ? heroLeague.weeklyMatchup : null}
                      matchupLoading={matchupLoading}
                      yahooConnected={yahoo.connected}
                      philosophySet={philosophySet}
                      onEnterDraft={handleEnterDraft}
                      onEnterSeason={handleEnterSeason}
                    />
                  </div>
                  <div className="lg:col-span-4">
                    <BeaneNote
                      gmProfile={gmProfile}
                      standing={heroStanding}
                      sportConfig={heroSportConfig}
                      weeklyMatchup={!isMatchupStale(heroLeague.weeklyMatchup) ? heroLeague.weeklyMatchup : null}
                    />
                  </div>
                </div>
              )}

              {/* League grid — info-only, click a card to make it active */}
              <div className="space-y-8">
                {sportGroups.map(({ sport, active, archived }) => (
                  <div key={sport}>
                    {hasMultipleSports && active.length > 0 && (
                      <div className="flex items-center gap-3 mb-3">
                        <h2 className="text-xs font-mono text-ink-secondary uppercase tracking-wider">
                          {SPORT_LABELS[sport] ?? sport.toUpperCase()}
                        </h2>
                        <div className="flex-1 border-t border-surface-line" />
                      </div>
                    )}

                    {active.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {active.map((league) => (
                          <LeagueSummaryCard
                            key={league.id}
                            league={league}
                            isActive={league.id === heroLeagueId}
                            onSelect={setSelectedHeroId}
                          />
                        ))}
                      </div>
                    )}

                    {archived.length > 0 && (
                      <ArchivedSection
                        leagues={archived}
                        sport={sport}
                        confirmDelete={confirmDelete}
                        {...sharedCardProps}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}

function ArchivedSection({ leagues, sport, confirmDelete, ...cardProps }) {
  const [expanded, setExpanded] = useState(false)

  // Group by season year, sorted newest first
  const byYear = {}
  for (const l of leagues) {
    const year = getLeagueYear(l) ?? 'Other'
    if (!byYear[year]) byYear[year] = []
    byYear[year].push(l)
  }
  const years = Object.keys(byYear).sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return Number(b) - Number(a)
  })

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(p => !p)}
        className="text-xs font-mono text-ink-muted hover:text-ink-secondary transition-colors"
      >
        {expanded ? '↑' : '↓'} Archived ({leagues.length})
      </button>
      {expanded && (
        <div className="mt-3 space-y-5">
          {years.map(year => (
            <div key={year}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-ink-muted">
                  {year === 'Other' ? 'Other' : formatSeasonYear(Number(year), sport)}
                </span>
                <div className="flex-1 border-t border-surface-line/40" />
              </div>
              <div className="space-y-3">
                {byYear[year].map((league) => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    confirmingDelete={confirmDelete === league.id}
                    {...cardProps}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LeagueCard({ league, yahooConnected, confirmingDelete, onEnterDraft, onEnterSeason, onEdit, onDelete, onCancelDelete, archiveLeague, onUnarchive }) {
  const { config, status, draft } = league
  const { updateLeagueConfig, importDraft } = useLeagueStore()
  const pickCount = draft.picks.length
  const round = pickCount > 0 ? Math.ceil(pickCount / config.numTeams) : 0
  const isSeason = status === 'season'
  const isDrafting = status === 'drafting'
  const isArchived = status === 'complete'
  const draftComplete = Boolean(config.draftSynced) || isSeason || isArchived
  const showSeasonHub = isSeason || isArchived || draftComplete

  const rosters = league.leagueRosters ?? null
  const sport = config.sport ?? 'nba'
  const standing = (isSeason && rosters?.teams?.length)
    ? computeTeamStanding({ league, rosters, players: playersFor(sport), sportConfig: getSportConfig(sport) })
    : null
  const userEntry = standing?.userEntry ?? null
  const tierStyle = userEntry ? TIER_STYLES[userEntry.tier] ?? null : null
  const trendArrow = userEntry && standing.trend ? STANDING_TREND_ARROW[standing.trend] : null

  const [picker, setPicker] = useState({ open: false, loading: false, leagues: [], error: null })
  const [syncState, setSyncState] = useState({ loading: false, error: null })

  const openPicker = async () => {
    setPicker({ open: true, loading: true, leagues: [], error: null })
    try {
      const res = await fetch(`/api/yahoo/my-leagues?sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load leagues')
      setPicker({ open: true, loading: false, leagues: data.leagues, error: null })
    } catch (err) {
      setPicker({ open: true, loading: false, leagues: [], error: err.message })
    }
  }

  const selectLeague = (yl) => {
    updateLeagueConfig(league.id, {
      yahooLeagueKey: yl.leagueKey,
      yahooLeagueName: yl.name,
      ...(yl.season != null && { yahooSeason: yl.season }),
    })
    setPicker({ open: false, loading: false, leagues: [], error: null })
  }

  const syncDraft = async () => {
    setSyncState({ loading: true, error: null })
    try {
      const res = await fetch(`/api/yahoo/sync-draft?leagueKey=${encodeURIComponent(config.yahooLeagueKey)}&sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      if (data.isSeasonOver) {
        updateLeagueConfig(league.id, { isSeasonOver: true })
        setSyncState({ loading: false, error: null })
        return
      }
      importDraft(league.id, data.picks, data.draftPosition)
      setSyncState({ loading: false, error: null })
    } catch (err) {
      setSyncState({ loading: false, error: err.message })
    }
  }

  return (
    <Card variant="data">

      {/* Main row: info + primary actions */}
      <div className="flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-ink-primary truncate">{config.name || 'Unnamed League'}</span>
            <span className={`text-xs font-mono ${STATUS_COLOR[status] ?? 'text-ink-secondary'}`}>
              {STATUS_LABEL[status] ?? status}
            </span>
            {tierStyle && (
              <span className={`text-micro font-mono px-1.5 py-0.5 rounded-full border uppercase ${tierStyle.bg} ${tierStyle.color}`}>
                {tierStyle.label}
              </span>
            )}
            {trendArrow && <span className={`text-xs font-mono ${trendArrow.color}`}>{trendArrow.icon}</span>}
          </div>
          <div className="text-xs text-ink-secondary mt-0.5 font-mono">
            {config.numTeams} teams · Pick {config.draftPosition} · {config.scoringFormat?.toUpperCase() ?? '9CAT'}
            {isDrafting && pickCount > 0 && ` · R${round} P${pickCount + 1}`}
            {userEntry && ` · #${userEntry.team.rank ?? '?'} ${userEntry.team.wins}-${userEntry.team.losses}${userEntry.team.ties ? `-${userEntry.team.ties}` : ''}`}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showSeasonHub ? (
            <button
              onClick={() => onEnterSeason(league.id)}
              className="px-4 py-1.5 bg-beane-green text-[#06120C] rounded-lg text-xs font-semibold hover:brightness-110 transition-colors"
            >
              Season Hub
            </button>
          ) : (
            <button
              onClick={() => onEnterDraft(league.id)}
              className="px-4 py-1.5 bg-beane-green text-[#06120C] rounded-lg text-xs font-semibold hover:brightness-110 transition-colors"
            >
              Draft Board
            </button>
          )}
          <button
            onClick={() => onEdit(league.id)}
            className="px-3 py-1.5 border border-surface-line text-ink-secondary rounded-lg text-xs hover:text-ink-primary hover:border-ink-secondary transition-colors"
          >
            Edit
          </button>
          {showSeasonHub && (
            <button
              onClick={() => onEnterDraft(league.id)}
              className="px-3 py-1.5 border border-surface-line text-ink-muted rounded-lg text-xs hover:text-ink-secondary hover:border-ink-secondary transition-colors"
            >
              ← Draft
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Yahoo (left) + archive/delete (right) */}
      <div className="mt-3 pt-3 border-t border-surface-line flex items-start justify-between gap-4">

        {/* Yahoo side */}
        <div className="flex-1 min-w-0">
          {yahooConnected && (
            config.yahooLeagueKey ? (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-ink-secondary font-mono">
                    Yahoo: <span className="text-ink-primary">{config.yahooLeagueName ?? config.yahooLeagueKey}</span>
                  </span>
                  {config.isSeasonOver ? (
                    <span className="text-xs text-ink-muted font-mono">· Season complete</span>
                  ) : config.draftSynced ? (
                    <>
                      <span className="text-xs text-ink-muted font-mono">· Picks imported</span>
                      <button
                        onClick={syncDraft}
                        disabled={syncState.loading}
                        className="text-xs text-ink-secondary hover:text-ink-primary underline underline-offset-2 transition-colors disabled:opacity-40"
                      >
                        {syncState.loading ? 'Syncing…' : 'Re-sync'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={syncDraft}
                      disabled={syncState.loading}
                      className="text-xs text-ink-secondary hover:text-ink-primary transition-colors disabled:opacity-40"
                    >
                      {syncState.loading ? '· Importing…' : '· Import Picks'}
                    </button>
                  )}
                </div>
                {syncState.error && (
                  <p className="text-xs text-signal-down mt-1">{syncState.error}</p>
                )}
              </div>
            ) : (
              <div>
                <button
                  onClick={openPicker}
                  className="text-xs text-ink-secondary hover:text-ink-primary transition-colors"
                >
                  + Link Yahoo league
                </button>
                {picker.open && (
                  <div className="mt-2">
                    {picker.loading && <p className="text-xs text-ink-secondary font-mono">Loading leagues…</p>}
                    {picker.error && <p className="text-xs text-signal-down">{picker.error}</p>}
                    {!picker.loading && !picker.error && picker.leagues.length === 0 && (
                      <p className="text-xs text-ink-secondary">No active leagues found.</p>
                    )}
                    {!picker.loading && picker.leagues.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1">
                        {picker.leagues.map((yl) => (
                          <button
                            key={yl.leagueKey}
                            onClick={() => selectLeague(yl)}
                            className="text-left text-xs px-3 py-2 rounded bg-surface-base border border-surface-line hover:border-ink-secondary hover:text-ink-primary text-ink-primary transition-colors"
                          >
                            <span className="font-medium">{yl.name}</span>
                            <span className="text-ink-secondary ml-2">{yl.numTeams} teams · {yl.season}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Archive + Delete side */}
        <div className="shrink-0 flex items-center gap-3">
          {isSeason && (
            <button
              onClick={() => archiveLeague(league.id)}
              className="text-xs text-ink-muted hover:text-ink-secondary transition-colors"
            >
              Archive
            </button>
          )}
          {isArchived && (
            <button
              onClick={() => onUnarchive(league.id)}
              className="text-xs text-ink-muted hover:text-ink-secondary transition-colors"
            >
              Restore
            </button>
          )}
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDelete(league.id)}
                className="px-3 py-1 bg-signal-down text-[#1A0505] rounded-lg text-xs font-semibold hover:brightness-110 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={onCancelDelete}
                className="px-3 py-1 border border-surface-line text-ink-secondary rounded-lg text-xs hover:text-ink-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => onDelete(league.id)}
              className="text-xs text-ink-muted hover:text-signal-down transition-colors"
            >
              Delete
            </button>
          )}
        </div>

      </div>
    </Card>
  )
}

// Quick actions for whichever league the Hero/Beane's Note is currently
// showing — consolidates what used to be a full action row on every
// league card into one place "at the very top," since you only ever act
// on one league at a time. Archived leagues keep their own full LeagueCard
// treatment below (a command-center quick-action bar doesn't make sense
// for something you're not actively managing).
function ActiveLeagueBar({ league, yahooConnected, onEnterDraft, onEnterSeason, onEdit, onDelete, confirmingDelete, onCancelDelete, archiveLeague, onUnarchive }) {
  const { config, status } = league
  const { updateLeagueConfig, importDraft } = useLeagueStore()
  const isSeason = status === 'season'
  const isArchived = status === 'complete'
  const draftComplete = Boolean(config.draftSynced) || isSeason || isArchived
  const showSeasonHub = isSeason || isArchived || draftComplete
  const sport = config.sport ?? 'nba'

  const [picker, setPicker] = useState({ open: false, loading: false, leagues: [], error: null })
  const [syncState, setSyncState] = useState({ loading: false, error: null })

  const openPicker = async () => {
    setPicker({ open: true, loading: true, leagues: [], error: null })
    try {
      const res = await fetch(`/api/yahoo/my-leagues?sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load leagues')
      setPicker({ open: true, loading: false, leagues: data.leagues, error: null })
    } catch (err) {
      setPicker({ open: true, loading: false, leagues: [], error: err.message })
    }
  }

  const selectLeague = (yl) => {
    updateLeagueConfig(league.id, {
      yahooLeagueKey: yl.leagueKey,
      yahooLeagueName: yl.name,
      ...(yl.season != null && { yahooSeason: yl.season }),
    })
    setPicker({ open: false, loading: false, leagues: [], error: null })
  }

  const syncDraft = async () => {
    setSyncState({ loading: true, error: null })
    try {
      const res = await fetch(`/api/yahoo/sync-draft?leagueKey=${encodeURIComponent(config.yahooLeagueKey)}&sport=${sport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      if (data.isSeasonOver) {
        updateLeagueConfig(league.id, { isSeasonOver: true })
        setSyncState({ loading: false, error: null })
        return
      }
      importDraft(league.id, data.picks, data.draftPosition)
      setSyncState({ loading: false, error: null })
    } catch (err) {
      setSyncState({ loading: false, error: err.message })
    }
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {showSeasonHub ? (
          <button
            onClick={() => onEnterSeason(league.id)}
            className="px-4 py-1.5 bg-beane-green text-[#06120C] rounded-lg text-xs font-semibold hover:brightness-110 transition-colors"
          >
            Season Hub
          </button>
        ) : (
          <button
            onClick={() => onEnterDraft(league.id)}
            className="px-4 py-1.5 bg-beane-green text-[#06120C] rounded-lg text-xs font-semibold hover:brightness-110 transition-colors"
          >
            Draft Board
          </button>
        )}
        <button
          onClick={() => onEdit(league.id)}
          className="px-3 py-1.5 border border-surface-line text-ink-secondary rounded-lg text-xs hover:text-ink-primary hover:border-ink-secondary transition-colors"
        >
          Edit
        </button>

        {yahooConnected && (
          config.yahooLeagueKey ? (
            !config.isSeasonOver && (
              <button
                onClick={syncDraft}
                disabled={syncState.loading}
                className="px-3 py-1.5 border border-surface-line text-ink-secondary rounded-lg text-xs hover:text-ink-primary hover:border-ink-secondary transition-colors disabled:opacity-40"
              >
                {syncState.loading ? 'Syncing…' : config.draftSynced ? 'Resync' : 'Import Picks'}
              </button>
            )
          ) : (
            <div className="relative">
              <button
                onClick={openPicker}
                className="px-3 py-1.5 border border-surface-line text-ink-secondary rounded-lg text-xs hover:text-ink-primary hover:border-ink-secondary transition-colors"
              >
                Link Yahoo
              </button>
              {picker.open && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-surface-overlay border border-surface-line rounded-lg overflow-hidden min-w-[240px] shadow-lg">
                  {picker.loading && <p className="text-xs text-ink-secondary font-mono px-3 py-2">Loading leagues…</p>}
                  {picker.error && <p className="text-xs text-signal-down px-3 py-2">{picker.error}</p>}
                  {!picker.loading && !picker.error && picker.leagues.length === 0 && (
                    <p className="text-xs text-ink-secondary px-3 py-2">No active leagues found.</p>
                  )}
                  {!picker.loading && picker.leagues.map((yl) => (
                    <button
                      key={yl.leagueKey}
                      onClick={() => selectLeague(yl)}
                      className="block w-full text-left px-3 py-2 text-xs text-ink-primary hover:bg-surface-line/40 transition-colors"
                    >
                      <span className="font-medium">{yl.name}</span>
                      <span className="text-ink-secondary ml-2">{yl.numTeams} teams · {yl.season}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {isSeason && (
          <button
            onClick={() => archiveLeague(league.id)}
            className="px-3 py-1.5 border border-surface-line text-ink-muted rounded-lg text-xs hover:text-ink-secondary hover:border-ink-secondary transition-colors"
          >
            Archive
          </button>
        )}
        {isArchived && (
          <button
            onClick={() => onUnarchive(league.id)}
            className="px-3 py-1.5 border border-surface-line text-ink-muted rounded-lg text-xs hover:text-ink-secondary hover:border-ink-secondary transition-colors"
          >
            Restore
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {confirmingDelete ? (
            <>
              <button
                onClick={() => onDelete(league.id)}
                className="px-3 py-1.5 bg-signal-down text-[#1A0505] rounded-lg text-xs font-semibold hover:brightness-110 transition-colors"
              >
                Confirm Delete
              </button>
              <button
                onClick={onCancelDelete}
                className="px-3 py-1.5 border border-surface-line text-ink-secondary rounded-lg text-xs hover:text-ink-primary transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => onDelete(league.id)}
              className="px-3 py-1.5 text-xs text-ink-muted hover:text-signal-down transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {syncState.error && <p className="text-xs text-signal-down mt-1.5">{syncState.error}</p>}
    </div>
  )
}

// Minimal info-only card for the league grid (D01 mockup 4.1) — sport
// badge, record, standing tier, trend arrow, click to make it the active
// league. No action buttons here anymore; those live in ActiveLeagueBar
// above, scoped to whichever league is currently active.
function LeagueSummaryCard({ league, isActive, onSelect }) {
  const { config, status, draft } = league
  const sport = config.sport ?? 'nba'
  const pickCount = draft.picks.length
  const round = pickCount > 0 ? Math.ceil(pickCount / config.numTeams) : 0
  const isSeason = status === 'season'
  const isDrafting = status === 'drafting'

  const rosters = league.leagueRosters ?? null
  const standing = (isSeason && rosters?.teams?.length)
    ? computeTeamStanding({ league, rosters, players: playersFor(sport), sportConfig: getSportConfig(sport) })
    : null
  const userEntry = standing?.userEntry ?? null
  const tierStyle = userEntry ? TIER_STYLES[userEntry.tier] ?? null : null
  const trendArrow = userEntry && standing.trend ? STANDING_TREND_ARROW[standing.trend] : null

  return (
    <button
      onClick={() => onSelect(league.id)}
      className={`text-left rounded-xl border p-4 transition-colors bg-surface-raised ${
        isActive ? 'border-beane-green/50' : 'border-surface-line hover:border-ink-secondary'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-micro font-mono text-ink-muted uppercase tracking-wider">
          {SPORT_LABELS[sport] ?? sport.toUpperCase()} · {config.scoringFormat?.toUpperCase() ?? '9CAT'}
        </span>
        {trendArrow && <span className={`text-sm font-mono ${trendArrow.color}`}>{trendArrow.icon}</span>}
      </div>
      <p className="font-semibold text-ink-primary text-sm truncate mb-0.5">{config.name || 'Unnamed League'}</p>
      <p className="text-xs font-mono tabular-nums text-ink-secondary">
        {userEntry
          ? `${userEntry.team.wins}-${userEntry.team.losses}${userEntry.team.ties ? `-${userEntry.team.ties}` : ''} · #${userEntry.team.rank ?? '?'} of ${rosters.teams.length}`
          : isDrafting
            ? (pickCount > 0 ? `R${round} · Pick ${pickCount + 1}` : 'Draft not started')
            : `${config.numTeams} teams`}
      </p>
      {tierStyle && (
        <span className={`inline-block mt-2 text-micro font-mono px-1.5 py-0.5 rounded-full border uppercase ${tierStyle.bg} ${tierStyle.color}`}>
          {tierStyle.label}
        </span>
      )}
    </button>
  )
}

function YahooConnect({ yahoo }) {
  if (yahoo.loading) {
    return (
      <Card variant="data" className="mb-6 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-ink-muted animate-pulse" />
        <span className="text-xs text-ink-secondary font-mono">Checking Yahoo connection…</span>
      </Card>
    )
  }

  return (
    <Card variant="data" className="mb-6 flex items-center justify-between">
      <div>
        <p className="text-sm text-ink-primary font-medium">Connect Yahoo Fantasy</p>
        <p className="text-xs text-ink-secondary mt-0.5">Required for live draft sync and season management</p>
      </div>
      <a
        href="/api/auth/yahoo/login"
        className="px-4 py-2 bg-beane-green text-[#06120C] rounded-lg text-xs font-semibold hover:brightness-110 transition-colors shrink-0"
      >
        Connect Yahoo →
      </a>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="border border-dashed border-surface-line rounded-lg px-8 py-14 text-center">
      <p className="text-ink-secondary mb-1">No leagues set up yet.</p>
      <p className="text-ink-muted text-sm mb-6">
        Add one for each Yahoo draft you're running. ESPN and other platforms are coming soon.
        PocketBeane runs alongside your live draft and tells you who to pick.
      </p>
      <Link
        href="/setup"
        className="px-5 py-2.5 bg-beane-green text-[#06120C] rounded-lg text-sm font-semibold hover:brightness-110 transition-colors"
      >
        Set Up a League
      </Link>
    </div>
  )
}
