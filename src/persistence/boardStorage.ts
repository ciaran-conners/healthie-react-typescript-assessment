import type { BoardData } from '../components/kanban/types'

const STORAGE_KEY = 'interdimensional-kanban:v1'

function isBoardData(value: unknown): value is BoardData {
  if (typeof value !== 'object' || value === null) return false
  const { cards, cardIdsByColumn } = value as Partial<BoardData>
  return (
    typeof cards === 'object' &&
    cards !== null &&
    typeof cardIdsByColumn === 'object' &&
    cardIdsByColumn !== null &&
    Object.values(cardIdsByColumn).every(Array.isArray)
  )
}

export function loadBoard(): BoardData | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    return isBoardData(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function saveBoard(board: BoardData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
  } catch {
    // Storage can be full or blocked (e.g. private mode); the board still works in memory.
  }
}
