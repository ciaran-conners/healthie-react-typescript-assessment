import type { BoardData, Card } from '../../types'

const STORAGE_KEY = 'interdimensional-kanban:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCard(value: unknown): value is Card {
  if (!isRecord(value) || !isRecord(value.character)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.character.name === 'string' &&
    typeof value.character.image === 'string'
  )
}

// Storage is untrusted (older versions, manual edits), so validate before rendering from it.
function isBoardData(value: unknown): value is BoardData {
  if (!isRecord(value) || !isRecord(value.cards) || !isRecord(value.cardIdsByColumn)) return false
  return (
    Object.values(value.cards).every(isCard) &&
    Object.values(value.cardIdsByColumn).every(
      (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
    )
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
    // Full or blocked storage (e.g. private mode) shouldn't break the board; it keeps working in memory.
  }
}
