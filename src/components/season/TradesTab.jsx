import { useState } from 'react'
import { AdvisorCard, AdvisorError } from '@/components/ui'
import useLeagueStore from '@/store/leagueStore'
import { TradeFavorBar, TradePlayerToggle } from './shared'

function TradeAnalyzerPanel({ league, rosters }) {
  const { setSeasonAdvice } = useLeagueStore()
  const userTeam = rosters.teams.find(t => t.isUser)
  const otherTeams = rosters.teams.filter(t => !t.isUser)

  // Seeded from the store, including the in-progress give/receive picks —
  // this is the one advisor where a tab switch could previously destroy
  // real user input (a half-built trade), not just a fetched result.
  const saved = league.seasonAdvice?.tradeAnalyzer ?? {}
  const [give, setGive] = useState(saved.give ?? [])
  const [receiveTeamKey, setReceiveTeamKey] = useState(saved.receiveTeamKey ?? '')
  const [receive, setReceive] = useState(saved.receive ?? [])
  const [advice, setAdvice] = useState(saved.advice ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const sport = league.config.sport ?? 'nba'

  function persist(next) {
    setSeasonAdvice(league.id, 'tradeAnalyzer', { give, receiveTeamKey, receive, advice, ...next })
  }

  const gmProfile = {
    injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
    draftStrategy: league.config.philosophy?.strategy ?? 'beane',
  }
  const rosterConfig = { ilSlots: league.config.ilSlots, ilPlusSlots: league.config.ilPlusSlots }

  const receiveTeam = otherTeams.find(t => t.teamKey === receiveTeamKey) ?? null

  function toggleGive(name) {
    const next = give.includes(name) ? give.filter(n => n !== name) : [...give, name]
    setGive(next)
    persist({ give: next })
  }

  function toggleReceive(name) {
    const next = receive.includes(name) ? receive.filter(n => n !== name) : [...receive, name]
    setReceive(next)
    persist({ receive: next })
  }

  function handleReceiveTeamChange(teamKey) {
    setReceiveTeamKey(teamKey)
    setReceive([]) // a trade only involves one opposing team — switching resets the picks
    persist({ receiveTeamKey: teamKey, receive: [] })
  }

  async function handleGetAdvice() {
    if (!give.length || !receive.length) {
      setError('Pick at least one player on each side of the trade.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/season/trade-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, leagueRosters: rosters, give, receive, gmProfile, rosterConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Advice failed')
      setAdvice(data)
      persist({ advice: data })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdvisorCard eyebrow="THE VERDICT">
      <div className="mb-3">
        <h3 className="font-display text-heading font-medium text-ink-primary">Trade Analyzer</h3>
        <p className="text-xs text-ink-secondary mt-0.5">
          Pick players from your roster and an opponent's to see the net category impact, positional fit, and buy-low/sell-high signal.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-micro font-mono text-ink-muted uppercase tracking-wider">
            You give {give.length > 0 && <span className="text-beane-green-text tabular-nums">({give.length})</span>}
          </label>
          <div className="mt-1 space-y-1 max-h-64 overflow-y-auto pr-1">
            {userTeam?.roster.map(p => (
              <TradePlayerToggle
                key={p.playerId ?? p.name}
                player={p}
                selected={give.includes(p.name)}
                onToggle={() => toggleGive(p.name)}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="text-micro font-mono text-ink-muted uppercase tracking-wider">
            You receive {receive.length > 0 && <span className="text-beane-green-text tabular-nums">({receive.length})</span>}
          </label>
          <select
            value={receiveTeamKey}
            onChange={(e) => handleReceiveTeamChange(e.target.value)}
            className="mt-1 w-full bg-surface-base border border-surface-line rounded px-2.5 py-1.5 text-xs text-ink-primary focus:outline-none focus:border-beane-green/50"
          >
            <option value="">Select opponent…</option>
            {otherTeams.map(t => (
              <option key={t.teamKey} value={t.teamKey}>{t.teamName}</option>
            ))}
          </select>
          <div className="mt-1.5 space-y-1 max-h-56 overflow-y-auto pr-1">
            {receiveTeam ? (
              receiveTeam.roster.map(p => (
                <TradePlayerToggle
                  key={p.playerId ?? p.name}
                  player={p}
                  selected={receive.includes(p.name)}
                  onToggle={() => toggleReceive(p.name)}
                />
              ))
            ) : (
              <p className="text-xs text-ink-muted px-1 py-1">Pick an opponent to see their roster.</p>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleGetAdvice}
        disabled={loading}
        className="text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {advice ? 'Refresh' : "Get Beane's Take"}
      </button>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Weighing the trade…</p>
      )}

      {error && !loading && (
        <AdvisorError message={error} onRetry={handleGetAdvice} />
      )}

      {advice && !loading && (
        <div className="mt-4 space-y-4">
          <TradeFavorBar favorScore={advice.favorScore} partnerTeamName={advice.partnerTeamName ?? 'Opponent'} />
          {advice.outlook && (
            <p className="text-xs text-ink-secondary leading-relaxed italic">{advice.outlook}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {advice.improveCategories?.length > 0 && (
              <div>
                <p className="text-micro font-mono text-signal-up uppercase tracking-wider mb-1.5">Improves</p>
                <div className="flex flex-wrap gap-1">
                  {advice.improveCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-up/15 text-signal-up px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.declineCategories?.length > 0 && (
              <div>
                <p className="text-micro font-mono text-signal-down uppercase tracking-wider mb-1.5">Declines</p>
                <div className="flex flex-wrap gap-1">
                  {advice.declineCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-signal-down/15 text-signal-down px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {advice.neutralCategories?.length > 0 && (
              <div>
                <p className="text-micro font-mono text-ink-secondary uppercase tracking-wider mb-1.5">Neutral</p>
                <div className="flex flex-wrap gap-1">
                  {advice.neutralCategories.map(c => (
                    <span key={c} className="text-xs font-mono bg-surface-overlay text-ink-secondary px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {advice.positionalNote && (
            <p className="text-xs text-ink-secondary border-t border-surface-line pt-3 leading-relaxed">
              <span className="text-ink-primary font-medium">Positional fit:</span> {advice.positionalNote}
            </p>
          )}
          {advice.buyLowSellHighNote && (
            <p className="text-xs text-ink-secondary leading-relaxed">
              <span className="text-ink-primary font-medium">Buy-low/sell-high:</span> {advice.buyLowSellHighNote}
            </p>
          )}
          {advice.reason && (
            <p className="text-xs text-ink-secondary leading-relaxed">{advice.reason}</p>
          )}
        </div>
      )}
    </AdvisorCard>
  )
}

function TradeValueIndexPanel({ league, rosters }) {
  const { setSeasonAdvice } = useLeagueStore()
  const [index, setIndex] = useState(league.seasonAdvice?.tradeValueIndex ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const sport = league.config.sport ?? 'nba'

  const gmProfile = {
    injuryTolerance: league.config.philosophy?.injuryTolerance ?? 'moderate',
    draftStrategy: league.config.philosophy?.strategy ?? 'beane',
  }
  const rosterConfig = { ilSlots: league.config.ilSlots, ilPlusSlots: league.config.ilPlusSlots }

  async function handleGetIndex() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/season/trade-value-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, leagueRosters: rosters, gmProfile, rosterConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Index failed')
      setIndex(data)
      setSeasonAdvice(league.id, 'tradeValueIndex', data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdvisorCard eyebrow="THE TRADE MARKET">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="font-display text-heading font-medium text-ink-primary">Trade Value Index</h3>
          <p className="text-xs text-ink-secondary mt-0.5">
            Sell-high candidates on your roster, buy-low targets across the league, and specific trade fits worth pursuing now.
          </p>
        </div>
        <button
          onClick={handleGetIndex}
          disabled={loading}
          className="shrink-0 text-xs font-mono px-3 py-1.5 bg-beane-green/10 border border-beane-green/30 text-beane-green-text rounded hover:bg-beane-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {index ? 'Refresh' : "Get Beane's Take"}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-ink-secondary font-mono mt-4 animate-pulse">Scanning trade value…</p>
      )}

      {error && !loading && (
        <AdvisorError message={error} onRetry={handleGetIndex} />
      )}

      {index && !loading && (
        <div className="mt-4 space-y-4">
          {index.headline && (
            <p className="text-xs text-ink-secondary italic leading-relaxed">{index.headline}</p>
          )}
          {index.sellHigh?.length > 0 && (
            <div className="space-y-2">
              <p className="text-micro font-mono text-signal-up uppercase tracking-wider">Sell high (your roster)</p>
              {index.sellHigh.map((entry, i) => (
                <div key={i} className="border border-surface-line rounded-md px-4 py-3">
                  <p className="text-xs text-signal-up font-medium mb-1">{entry.player}</p>
                  <p className="text-xs text-ink-secondary leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
          {index.buyLowTargets?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-surface-line">
              <p className="text-micro font-mono text-signal-info uppercase tracking-wider pt-2">Buy low (league targets)</p>
              {index.buyLowTargets.map((entry, i) => (
                <div key={i} className="border border-surface-line rounded-md px-4 py-3">
                  <p className="text-xs text-signal-info font-medium mb-1">
                    {entry.player}
                    {entry.currentTeam && <span className="text-ink-muted font-normal"> · {entry.currentTeam}</span>}
                  </p>
                  <p className="text-xs text-ink-secondary leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
          {index.tradeOpportunityFlags?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-surface-line">
              <p className="text-micro font-mono text-ink-secondary uppercase tracking-wider pt-2">On the radar — specific fits</p>
              {index.tradeOpportunityFlags.map((flag, i) => (
                <p key={i} className="text-xs text-ink-secondary leading-relaxed">
                  <span className="text-ink-primary font-medium">{flag.player} ({flag.team}):</span> {flag.reason}
                </p>
              ))}
            </div>
          )}
          {!index.sellHigh?.length && !index.buyLowTargets?.length && !index.tradeOpportunityFlags?.length && (
            <p className="text-xs text-ink-secondary">No standout sell-high, buy-low, or trade-fit signals this week.</p>
          )}
        </div>
      )}
    </AdvisorCard>
  )
}

export default function TradesTab({ league, rosters }) {
  return (
    <div className="space-y-4">
      <TradeAnalyzerPanel league={league} rosters={rosters} />
      <TradeValueIndexPanel league={league} rosters={rosters} />
    </div>
  )
}
