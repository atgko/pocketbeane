import { useState } from 'react'
import { QUIZ_QUESTIONS } from '@/utils/gmProfile'
import Modal from '@/components/ui/Modal'

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
    <Modal
      onClose={onSkip}
      labelledBy="quiz-title"
      className="relative w-full max-w-md mx-4 bg-surface-raised border border-surface-line rounded-xl p-8 shadow-2xl"
    >
      {success ? (
        <SuccessState />
      ) : (
        <div
          className="transition-all duration-150"
          style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(6px)' : 'translateY(0)' }}
        >
          <Progress step={step} total={QUIZ_QUESTIONS.length} />

          <h2 id="quiz-title" className="text-lg font-semibold text-ink-primary mb-5 mt-6">
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
                      ? 'border-beane-green bg-beane-green/10'
                      : 'border-surface-line bg-surface-base hover:border-beane-green/60 hover:bg-beane-green/5'
                  }`}
                >
                  <div className={`font-medium text-sm transition-colors ${selected ? 'text-beane-green-text' : 'text-ink-primary group-hover:text-ink-primary'}`}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-ink-secondary mt-0.5">{opt.desc}</div>
                </button>
              )
            })}
          </div>

          <button
            onClick={onSkip}
            className="mt-5 w-full text-center text-xs text-ink-muted hover:text-ink-secondary transition-colors py-2"
          >
            Skip for now — use generic recommendations
          </button>
        </div>
      )}
    </Modal>
  )
}

function Progress({ step, total }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-beane-green' : 'bg-surface-line'}`}
        />
      ))}
      <span className="text-xs text-ink-secondary font-mono ml-1 shrink-0">
        {step + 1} of {total}
      </span>
    </div>
  )
}

function SuccessState() {
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 rounded-full bg-beane-green/20 flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-5 h-5 text-beane-green"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-ink-primary font-semibold text-lg">GM Profile set.</h3>
      <p className="text-ink-secondary text-sm mt-1">
        PocketBeane will now tailor picks to your style.
      </p>
    </div>
  )
}
