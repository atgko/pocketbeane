import { getSportConfig } from '@/config/sports'

const DRAFT_TYPE_OPTIONS = [
  { value: 'snake',   label: 'Snake' },
  { value: 'auction', label: 'Auction' },
]

const SCORING_OPTIONS = {
  nba: [
    { value: '9cat',   label: '9-Cat' },
    { value: '8cat',   label: '8-Cat' },
    { value: 'points', label: 'Points' },
  ],
  mlb: [
    { value: '5x5',   label: '5×5 Roto' },
    { value: '6x6',   label: '6×6' },
    { value: 'points', label: 'Points' },
  ],
}

const DEFAULT_SCORING_FORMAT = { nba: '9cat', mlb: '5x5' }

const STRATEGY_OPTIONS = [
  { value: 'beane',            label: 'Beane Mode' },
  { value: 'balanced',         label: 'Balanced' },
  { value: 'stars-and-scrubs', label: 'Stars & Scrubs' },
  { value: 'punt',             label: 'Punt Strategy' },
]

const AUCTION_STRATEGY_OPTIONS = [
  { value: 'beane',            label: 'Value Hunt' },
  { value: 'balanced',         label: 'Balanced' },
  { value: 'stars-and-scrubs', label: 'Stars & Scrubs' },
  { value: 'budget-control',   label: 'Budget Control' },
]

const STRATEGY_DESCRIPTIONS = {
  'beane':            'ADP value-first — exploit market mispricings, fill categories in the middle rounds.',
  'balanced':         'Even spread across all categories and positions from round one.',
  'stars-and-scrubs': 'Lock in elite production early, fill remaining spots with high-volume cheap picks.',
  'punt':             'Concede selected categories and dominate the rest.',
  'budget-control':   'Hold reserves, let opponents overspend early, then dominate when the market is broke.',
}

const INJURY_TOLERANCE_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate',     label: 'Moderate' },
  { value: 'aggressive',   label: 'Aggressive' },
]

const INJURY_TOLERANCE_DESCRIPTIONS = {
  'conservative': 'Avoid injury-risk players — dock their ranking significantly.',
  'moderate':     "Flag risk but don't automatically deprioritize.",
  'aggressive':   'Injury history = market discount. Exploit it.',
}

export default function LeagueSetup({ config, onUpdate, onToggleCategory, isYahooSynced = false }) {
  const sport = config.sport ?? 'nba'
  const sportConfig = getSportConfig(sport)
  const rosterSlots = sportConfig.slotOrder.filter(s => s.type !== 'BN')
  const bnSlot = sportConfig.slotOrder.find(s => s.type === 'BN')
  const lockedClass = 'opacity-40 pointer-events-none select-none'
  const scoringOptions = SCORING_OPTIONS[sport] ?? SCORING_OPTIONS.nba
  const defaultScoringFormat = DEFAULT_SCORING_FORMAT[sport] ?? '9cat'
  const isNonDefaultFormat = config.scoringFormat !== defaultScoringFormat

  return (
    <div className="space-y-4">

      {/* Draft Strategy — always editable */}
      <div className="bg-surface rounded-lg border border-border p-5 space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Draft Strategy</label>
          <ToggleGroup
            options={config.draftType === 'auction' ? AUCTION_STRATEGY_OPTIONS : STRATEGY_OPTIONS}
            value={config.philosophy?.strategy ?? 'beane'}
            onChange={v => onUpdate('philosophy', {
              ...config.philosophy,
              strategy: v,
              puntCategories: v !== 'punt' ? [] : (config.philosophy?.puntCategories ?? []),
            })}
          />
          <p className="text-xs text-gray-600 mt-1.5 font-mono">
            {STRATEGY_DESCRIPTIONS[config.philosophy?.strategy ?? 'beane']}
          </p>
          {config.philosophy?.strategy === 'punt' && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2 font-mono">Categories to punt:</p>
              <div className="flex flex-wrap gap-2">
                {sportConfig.categories.map(cat => {
                  const punted = (config.philosophy?.puntCategories ?? []).includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        const curr = config.philosophy?.puntCategories ?? []
                        const next = punted ? curr.filter(c => c !== cat.id) : [...curr, cat.id]
                        onUpdate('philosophy', { ...config.philosophy, puntCategories: next })
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                        punted
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-bg border border-border text-gray-400 hover:border-red-500/40 hover:text-red-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Injury Tolerance</label>
          <ToggleGroup
            options={INJURY_TOLERANCE_OPTIONS}
            value={config.philosophy?.injuryTolerance ?? 'moderate'}
            onChange={v => onUpdate('philosophy', { ...config.philosophy, injuryTolerance: v })}
          />
          <p className="text-xs text-gray-600 mt-1.5 font-mono">
            {INJURY_TOLERANCE_DESCRIPTIONS[config.philosophy?.injuryTolerance ?? 'moderate']}
          </p>
        </div>
      </div>

      {/* League Composition — locked when Yahoo-synced */}
      <div className="bg-surface rounded-lg border border-border p-5 space-y-5">
        {isYahooSynced && (
          <p className="text-xs text-gray-600 font-mono">
            League structure synced from Yahoo.
          </p>
        )}

        {/* Teams + Draft Position */}
        <div className={`grid grid-cols-2 gap-4 ${isYahooSynced ? lockedClass : ''}`}>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Teams</label>
            <select
              value={config.numTeams}
              onChange={e => onUpdate('numTeams', Number(e.target.value))}
              disabled={isYahooSynced}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-pick disabled:cursor-not-allowed"
            >
              {[8, 10, 12, 14, 16].map(n => (
                <option key={n} value={n}>{n} teams</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Draft Position</label>
            <select
              value={config.draftPosition}
              onChange={e => onUpdate('draftPosition', Number(e.target.value))}
              disabled={isYahooSynced}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-pick disabled:cursor-not-allowed"
            >
              {Array.from({ length: config.numTeams }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>Pick {n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Draft Type + Scoring */}
        <div className={`grid grid-cols-2 gap-4 ${isYahooSynced ? lockedClass : ''}`}>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Draft Type</label>
            <ToggleGroup
              options={DRAFT_TYPE_OPTIONS}
              value={config.draftType}
              disabled={isYahooSynced}
              onChange={v => {
                onUpdate('draftType', v)
                const strategy = config.philosophy?.strategy
                if (v === 'snake' && strategy === 'budget-control') {
                  onUpdate('philosophy', { ...config.philosophy, strategy: 'beane' })
                } else if (v === 'auction' && strategy === 'punt') {
                  onUpdate('philosophy', { ...config.philosophy, strategy: 'beane' })
                }
              }}
            />
            {config.draftType === 'auction' && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500">$</span>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={config.auctionBudget ?? 200}
                  onChange={e => onUpdate('auctionBudget', Math.max(1, Number(e.target.value)))}
                  className="w-20 bg-bg border border-border rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-pick [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs font-mono text-gray-600">budget per team</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Scoring Format</label>
            <ToggleGroup
              options={scoringOptions}
              value={config.scoringFormat}
              disabled={isYahooSynced}
              onChange={v => onUpdate('scoringFormat', v)}
            />
            {isNonDefaultFormat && (
              <p className="text-xs text-value mt-1.5 font-mono">
                {config.scoringFormat === 'points' ? 'Points' : scoringOptions.find(o => o.value === config.scoringFormat)?.label ?? config.scoringFormat} coming in a future phase — {defaultScoringFormat === '9cat' ? '9-cat' : '5×5 Roto'} only for now.
              </p>
            )}
          </div>
        </div>

        {/* Roster Slots */}
        <div className={isYahooSynced ? lockedClass : ''}>
          <label className="block text-xs text-gray-400 mb-1.5">Roster Slots</label>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {rosterSlots.map(slot => (
              <SlotCountRow
                key={slot.type}
                label={slot.type}
                value={config[slot.configKey]}
                onChange={v => onUpdate(slot.configKey, v)}
                max={slot.max ?? 3}
                disabled={isYahooSynced}
              />
            ))}
          </div>
          <div className="mt-2 space-y-2">
            {bnSlot && (
              <SlotCountRow
                label="BN"
                value={config[bnSlot.configKey]}
                onChange={v => onUpdate(bnSlot.configKey, v)}
                max={bnSlot.max ?? 6}
                disabled={isYahooSynced}
              />
            )}
            <SlotCountRow label="IL"  value={config.ilSlots ?? 0}     onChange={v => onUpdate('ilSlots', v)}     max={6} disabled={isYahooSynced} />
            <SlotCountRow label="IL+" value={config.ilPlusSlots ?? 0} onChange={v => onUpdate('ilPlusSlots', v)} max={4} disabled={isYahooSynced} />
          </div>
        </div>

        {/* Scoring Categories */}
        <div className={isYahooSynced ? lockedClass : ''}>
          <label className="block text-xs text-gray-400 mb-1.5">Scoring Categories</label>
          <div className="flex flex-wrap gap-2">
            {sportConfig.categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => !isYahooSynced && onToggleCategory(cat.id)}
                disabled={isYahooSynced}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                  config.categories.includes(cat.id)
                    ? 'bg-pick text-white'
                    : 'bg-bg border border-border text-gray-400 hover:border-pick hover:text-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-1.5 font-mono">{config.categories.length} categories selected</p>
        </div>
      </div>


    </div>
  )
}

function SlotCountRow({ label, value, onChange, max = 3, disabled = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 font-mono w-8">{label}</span>
      {Array.from({ length: max + 1 }, (_, n) => (
        <button
          key={n}
          type="button"
          onClick={() => !disabled && onChange(n)}
          disabled={disabled}
          className={`w-7 h-7 rounded text-xs font-mono transition-colors ${
            value === n
              ? 'bg-pick text-white'
              : 'bg-bg border border-border text-gray-400 hover:border-pick'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function ToggleGroup({ options, value, onChange, disabled = false }) {
  return (
    <div className="flex gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
            value === opt.value
              ? 'bg-pick text-white'
              : 'bg-bg border border-border text-gray-400 hover:border-pick hover:text-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
