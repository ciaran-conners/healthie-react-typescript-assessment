import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Moves focus to the first focusable element on open, traps it, and restores it on close. */
export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Captured during render: by the time an effect runs, the opener may already be disabled
  // (the board locks while a modal is open) and focus will have fallen back to <body>.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)

  useEffect(() => {
    const overlay = overlayRef.current
    const background = [...document.body.children].filter(
      (el) => el !== overlay && !el.hasAttribute('inert'),
    )
    background.forEach((el) => el.setAttribute('inert', ''))
    overlay?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    return () => {
      // Focus can't move into an inert subtree, so restore interactivity first.
      background.forEach((el) => el.removeAttribute('inert'))
      opener?.focus()
    }
  }, [opener])

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <h2 id={titleId} className="mb-4 text-lg font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
