import { useState } from 'react'
import { QUIZ_QUESTIONS, getGMProfile, INJURY_DISPLAY, CATEGORY_DISPLAY, STRATEGY_DISPLAY } from '@/utils/gmProfile'

export default function ProfileOverrideScreen({ leagueName, currentOverride, onSave, onCancel }) {
  const global = getGMProfile()

  const initial = {
    injuryTolerance: currentOverride?.injuryTolerance ?? global?.injuryTolerance ?? null,
    categoryStrategy: currentOverride?.categoryStrategy ?? global?.categoryStrategy ?? null,
    draftStrategy: currentOverride?.draftStrategy ?? global?.draftStrategy ?? null,
  }

  const [answers, setAnswers] = useState(initial)

  function toggle(field, value) {
    // Clicking the already-selected value clears it (reverts to global)
    setAnswers(prev => ({ ...prev, [field]: prev[field] === value ? null : value }))
  }

  function handleSave() {
    const hasAnyOverride =
      answers.injuryTolerance !== global?.injuryTolerance ||
      answers.categoryStrategy !== global?.categoryStrategy ||
      answers.draftStrategy !== global?.draftStrategy

    onSave({
      hasOverride: hasAnyOverride,
      injuryTolerance: answers.injuryTolerance !== global?.injuryTolerance ? answers.injuryTolerance : null,
      categoryStrategy: answers.categoryStrategy !== global?.categoryStrategy ? answers.categoryStrategy : null,
      draftStrategy: answers.draftStrategy !== global?.draftStrategy ? answers.draftStrategy : null,
    })
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6 mt-4">
      <div className="mb-5">
        <p className="text-sm font-semibold text-white">
          Customize GM Profile for {leagueName || 'this league'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 font-mono">
          Tap an answer to override it for this league only. Tap the selected answer to revert to global.
        </p>
      </div>

      <div className="space-y-5">
        {QUIZ_QUESTIONS.map(q => {
          const displayMap = q.id === 'injuryTolerance' ? INJURY_DISPLAY
            : q.id === 'categoryStrategy' ? CATEGORY_DISPLAY
            : STRATEGY_DISPLAY
          const globalValue = global?.[q.id]
          const currentValue = answers[q.id]

          return (
            <div key={q.id}>
              <p className="text-xs text-gray-400 mb-2 font-mono">{q.question}</p>
              <div className="flex flex-wrap gap-2">
                {q.options.map(opt => {
                  const isSelected = currentValue === opt.value
                  const isGlobal = globalValue === opt.value
                  const isOverride = isSelected && !isGlobal

                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggle(q.id, opt.value)}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition-colors border ${
                        isOverride
                          ? 'bg-value/20 border-value text-value'
                          : isSelected
                          ? 'bg-pick/10 border-pick text-pick'
                          : 'bg-bg border-border text-gray-400 hover:border-pick/40 hover:text-gray-200'
                      }`}
                    >
                      {displayMap[opt.value]}
                      {isGlobal && !isOverride && (
                        <span className="ml-1 text-gray-600">(global)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleSave}
          className="px-5 py-2 bg-pick text-white rounded-lg text-sm font-semibold hover:bg-green-500 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border text-gray-400 rounded-lg text-sm hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
