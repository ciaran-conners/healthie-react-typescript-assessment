import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId()

  const overlayRef = useRef<HTMLDivElement>(null)

  // Hand focus back to whatever opened the modal (e.g. the card's edit button). Captured during
  // render, because by the time an effect runs the opener may already be disabled (the board
  // locks while a modal is open) and the browser will have moved focus to <body>.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)

  useEffect(() => {
    // Trap focus by making everything outside the modal `inert`: unfocusable, unclickable and
    // hidden from assistive tech. Elements that were already inert are left alone.
    const background = [...document.body.children].filter(
      (el) => el !== overlayRef.current && !el.hasAttribute('inert'),
    )
    background.forEach((el) => el.setAttribute('inert', ''))

    return () => {
      // Un-inert first: focus can't move into an inert subtree.
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
