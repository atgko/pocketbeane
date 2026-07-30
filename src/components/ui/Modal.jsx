import { useEffect, useRef } from 'react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Shared dialog semantics for every fixed-overlay modal in the app (UndoModal,
// ShortcutsModal, PhilosophyQuiz): role="dialog", focus trap, focus restore
// on close, and its own Escape handler so each modal doesn't have to
// reimplement (or forget to implement) any of it.
export default function Modal({ onClose, labelledBy, children, className = '' }) {
  const dialogRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    previouslyFocused.current = document.activeElement
    const dialog = dialogRef.current
    const focusable = dialog?.querySelectorAll(FOCUSABLE)
    focusable?.[0]?.focus()

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={e => e.stopPropagation()}
        className={className}
      >
        {children}
      </div>
    </div>
  )
}
