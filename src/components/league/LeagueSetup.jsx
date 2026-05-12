import { CATEGORIES } from '@/constants/categories'

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

      {/* Roster Slots */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Roster Slots</label>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          <SlotCountRow label="PG"   value={config.pgSlots}   onChange={v => onUpdate('pgSlots', v)} />
          <SlotCountRow label="SG"   value={config.sgSlots}   onChange={v => onUpdate('sgSlots', v)} />
          <SlotCountRow label="G"    value={config.gSlots}    onChange={v => onUpdate('gSlots', v)} />
          <SlotCountRow label="SF"   value={config.sfSlots}   onChange={v => onUpdate('sfSlots', v)} />
          <SlotCountRow label="PF"   value={config.pfSlots}   onChange={v => onUpdate('pfSlots', v)} />
          <SlotCountRow label="F"    value={config.fSlots}    onChange={v => onUpdate('fSlots', v)} />
          <SlotCountRow label="C"    value={config.cSlots}    onChange={v => onUpdate('cSlots', v)} />
          <SlotCountRow label="UTIL" value={config.utilSlots} onChange={v => onUpdate('utilSlots', v)} max={4} />
        </div>
        <div className="mt-2">
          <SlotCountRow label="BN"   value={config.bnSlots}   onChange={v => onUpdate('bnSlots', v)} max={6} />
        </div>
      </div>

      {/* IL Slots */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Injured List</label>
        <div className="space-y-2">
          <SlotCountRow label="IL"  value={config.ilSlots ?? 0}     onChange={v => onUpdate('ilSlots', v)} />
          <SlotCountRow label="IL+" value={config.ilPlusSlots ?? 0} onChange={v => onUpdate('ilPlusSlots', v)} />
        </div>
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

function SlotCountRow({ label, value, onChange, max = 3 }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 font-mono w-8">{label}</span>
      {Array.from({ length: max + 1 }, (_, n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
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
