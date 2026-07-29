import { useState } from 'react'
import { QUIZ_QUESTIONS, getGMProfile, INJURY_DISPLAY, CATEGORY_DISPLAY, STRATEGY_DISPLAY } from '@/utils/gmProfile'
import { Card, Button } from '@/components/ui'

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
    <Card variant="data" className="mt-4">
      <div className="mb-5">
        <p className="text-sm font-semibold text-ink-primary">
          Customize GM Profile for {leagueName || 'this league'}
        </p>
        <p className="text-xs text-ink-secondary mt-0.5 font-mono">
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
              <p className="text-xs text-ink-secondary mb-2 font-mono">{q.question}</p>
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
                          ? 'bg-signal-watch/20 border-signal-watch text-signal-watch'
                          : isSelected
                          ? 'bg-beane-green/10 border-beane-green text-beane-green-text'
                          : 'bg-surface-base border-surface-line text-ink-secondary hover:border-beane-green/40 hover:text-ink-primary'
                      }`}
                    >
                      {displayMap[opt.value]}
                      {isGlobal && !isOverride && (
                        <span className="ml-1 text-ink-muted">(global)</span>
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
        <Button variant="primary" onClick={handleSave} className="text-sm">
          Save
        </Button>
        <Button variant="secondary" onClick={onCancel} className="text-sm">
          Cancel
        </Button>
      </div>
    </Card>
  )
}
