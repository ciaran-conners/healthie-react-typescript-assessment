import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { Point } from './boardMachine'

const COLORS = ['#97ce4c', '#f0e14a', '#44c4e6', '#f4a1c9', '#ffffff']

function makePieces(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2
    const distance = 60 + Math.random() * 140
    return {
      '--dx': `${Math.cos(angle) * distance}px`,
      // Bias upwards so the burst arcs before it falls.
      '--dy': `${Math.sin(angle) * distance - 60}px`,
      '--fall': `${140 + Math.random() * 180}px`,
      '--spin': `${(Math.random() * 2 - 1) * 900}deg`,
      '--w': `${5 + Math.random() * 5}px`,
      '--h': `${8 + Math.random() * 8}px`,
      '--delay': `${Math.random() * 90}ms`,
      '--duration': `${1100 + Math.random() * 500}ms`,
      '--color': COLORS[i % COLORS.length],
    } as CSSProperties
  })
}

/** A one-shot burst. The board mounts it per celebration (keyed), so it never needs to clean itself up. */
export function Confetti({ origin, pieceCount = 56 }: { origin: Point; pieceCount?: number }) {
  const [pieces] = useState(() => makePieces(pieceCount))

  return createPortal(
    <div
      className="confetti"
      style={{ '--x': `${origin.x}px`, '--y': `${origin.y}px` } as CSSProperties}
      aria-hidden="true"
      data-testid="confetti"
    >
      <span className="portal-ring" />
      {pieces.map((style, i) => (
        <span key={i} className="confetti-piece" style={style} />
      ))}
    </div>,
    document.body,
  )
}
