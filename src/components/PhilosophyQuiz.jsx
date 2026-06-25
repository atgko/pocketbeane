import { useState } from 'react'
import { QUIZ_QUESTIONS } from '@/utils/gmProfile'

export default function PhilosophyQuiz({ onComplete, onSkip, initialAnswers = {} }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(initialAnswers)
  const [success, setSuccess] = useState(false)
  const [fading, setFading] = useState(false)

  const question = QUIZ_QUESTIONS[step]
  const isLast = step === QUIZ_QUESTIONS.length - 1

  function selectAnswer(value) {
    const next = { ...answers, [question.id]: value }
    setAnswers(next)

    if (isLast) {
      setSuccess(true)
      setTimeout(() => onComplete(next), 1400)
      return
    }

    setFading(true)
    setTimeout(() => {
      setStep(s => s + 1)
      setFading(false)
    }, 180)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-surface border border-border rounded-xl p-8 shadow-2xl">
          {success ? (
            <SuccessState />
          ) : (
            <div
              className="transition-all duration-150"
              style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(6px)' : 'translateY(0)' }}
            >
              <Progress step={step} total={QUIZ_QUESTIONS.length} />

              <h2 className="text-lg font-semibold text-white mb-5 mt-6">
                {question.question}
              </h2>

              <div className="space-y-2.5">
                {question.options.map(opt => {
                  const selected = answers[question.id] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => selectAnswer(opt.value)}
                      className={`w-full text-left px-4 py-3.5 rounded-lg border transition-all group ${
                        selected
                          ? 'border-pick bg-pick/10'
                          : 'border-border bg-bg hover:border-pick/60 hover:bg-pick/5'
                      }`}
                    >
                      <div className={`font-medium text-sm transition-colors ${selected ? 'text-pick' : 'text-gray-200 group-hover:text-white'}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={onSkip}
                className="mt-5 w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors py-2"
              >
                Skip for now — use generic recommendations
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Progress({ step, total }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-pick' : 'bg-border'}`}
        />
      ))}
      <span className="text-xs text-gray-500 font-mono ml-1 shrink-0">
        {step + 1} of {total}
      </span>
    </div>
  )
}

function SuccessState() {
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 rounded-full bg-pick/20 flex items-center justify-center mx-auto mb-4">
        <span className="text-pick text-xl font-bold">✓</span>
      </div>
      <h3 className="text-white font-semibold text-lg">GM Profile set.</h3>
      <p className="text-gray-500 text-sm mt-1">
        PocketBeane will now tailor picks to your style.
      </p>
    </div>
  )
}
