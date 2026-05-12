import { CATEGORIES } from '@/constants/categories'

const IL_TYPE_OPTIONS = [
  { value: 'none',     label: '0',    title: 'No IL spots' },
  { value: 'standard', label: 'IL',   title: 'Standard IL (injured players only)' },
  { value: 'il_plus',  label: 'IL+',  title: 'IL+ (GTD, Out, DTD eligible)' },
]

const DRAFT_TYPE_OPTIONS = [
  { value: 'snake',   label: 'Snake' },
  { value: 'auction', label: 'Auction' },
]

const SCORING_OPTIONS = [
  { value: '9cat',   label: '9-Cat' },
  { value: '8cat',   label: '8-Cat' },
  { value: 'points', label: 'Points' },
]

export default function LeagueSetup({ config, onUpdate, onToggleCategory }) {
  return (
    <div className="bg-surface rounded-lg border border-border p-6 space-y-6">

      {/* League Name */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">League Name</label>
        <input
          type="text"
          value={config.name}
          onChange={e => onUpdate('name', e.target.value)}
          className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-pick"
          placeholder="e.g. Main League, Mock Draft #1"
        />
      </div>

      {/* Teams + Draft Position */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Teams</label>
          <select
            value={config.numTeams}
            onChange={e => onUpdate('numTeams', Number(e.target.value))}
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-pick"
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
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-pick"
          >
            {Array.from({ length: config.numTeams }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Pick {n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Draft Type + Scoring Format */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Draft Type</label>
          <ToggleGroup
            options={DRAFT_TYPE_OPTIONS}
            value={config.draftType}
            onChange={v => onUpdate('draftType', v)}
          />
          {config.draftType === 'auction' && (
            <p className="text-xs text-value mt-1.5 font-mono">Auction coming in a future phase — snake only for now.</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Scoring Format</label>
          <ToggleGroup
            options={SCORING_OPTIONS}
            value={config.scoringFormat}
            onChange={v => onUpdate('scoringFormat', v)}
          />
          {config.scoringFormat !== '9cat' && (
            <p className="text-xs text-value mt-1.5 font-mono">
              {config.scoringFormat === 'points' ? 'Points' : '8-Cat'} coming in a future phase — 9-cat only for now.
            </p>
          )}
        </div>
      </div>

      {/* IL Slots */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Injured List</label>
        <div className="flex gap-2">
          {IL_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              title={opt.title}
              onClick={() => onUpdate('ilType', opt.value)}
              className={`px-4 py-1.5 rounded text-xs font-mono transition-colors ${
                config.ilType === opt.value
                  ? 'bg-pick text-white'
                  : 'bg-bg border border-border text-gray-400 hover:border-pick hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {config.ilType !== 'none' && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">Slots:</span>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => onUpdate('ilSlots', n)}
                className={`w-7 h-7 rounded text-xs font-mono transition-colors ${
                  config.ilSlots === n
                    ? 'bg-pick text-white'
                    : 'bg-bg border border-border text-gray-400 hover:border-pick'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scoring Categories */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Scoring Categories</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onToggleCategory(cat.id)}
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
  )
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
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
