import type { BoardData, Card, CardDraft, CardId, ColumnDef, ColumnId, CompleteDraft } from './types'

// Pure board operations, called from the state machine's actions. Each returns the same
// reference when nothing changed, which is how the board detects real changes.

function emptyBoard(columns: ColumnDef[]): BoardData {
  return {
    cards: {},
    cardIdsByColumn: Object.fromEntries(columns.map((column) => [column.id, []])),
  }
}

/**
 * Reconciles a (possibly stale) saved board with the current column definitions:
 * every column gets a list, dangling ids are dropped, and orphaned cards land in the first column.
 */
export function normalizeBoard(columns: ColumnDef[], board?: BoardData): BoardData {
  if (!board) return emptyBoard(columns)

  const placed = new Set<CardId>()
  const cardIdsByColumn: Record<ColumnId, CardId[]> = {}
  for (const column of columns) {
    cardIdsByColumn[column.id] = (board.cardIdsByColumn[column.id] ?? []).filter((id) => {
      if (!(id in board.cards) || placed.has(id)) return false
      placed.add(id)
      return true
    })
  }

  const orphans = Object.keys(board.cards).filter((id) => !placed.has(id))
  if (orphans.length > 0 && columns.length > 0) {
    cardIdsByColumn[columns[0].id].push(...orphans)
  }

  return { cards: board.cards, cardIdsByColumn }
}

/** Resolves a droppable id (either a column id or a card id) to the column it belongs to. */
export function findColumnOf(board: BoardData, id: string): ColumnId | undefined {
  if (id in board.cardIdsByColumn) return id
  return Object.keys(board.cardIdsByColumn).find((columnId) =>
    board.cardIdsByColumn[columnId].includes(id),
  )
}

/**
 * Moves `activeId` to where `overId` is. `overId` may be a card (take its slot)
 * or a column (append to the end, which is how empty columns receive cards).
 */
export function moveCard(board: BoardData, activeId: CardId, overId: string): BoardData {
  const from = findColumnOf(board, activeId)
  const to = findColumnOf(board, overId)
  if (!from || !to || activeId === overId) return board

  const source = board.cardIdsByColumn[from]
  const fromIndex = source.indexOf(activeId)

  if (from === to) {
    const toIndex = overId === to ? source.length - 1 : source.indexOf(overId)
    if (fromIndex === toIndex) return board
    const reordered = [...source]
    reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, activeId)
    return { ...board, cardIdsByColumn: { ...board.cardIdsByColumn, [from]: reordered } }
  }

  const target = board.cardIdsByColumn[to]
  const toIndex = overId === to ? target.length : target.indexOf(overId)
  const nextTarget = [...target]
  nextTarget.splice(toIndex, 0, activeId)
  return {
    ...board,
    cardIdsByColumn: {
      ...board.cardIdsByColumn,
      [from]: source.filter((id) => id !== activeId),
      [to]: nextTarget,
    },
  }
}

export function addCard(board: BoardData, card: Card, columnId: ColumnId): BoardData {
  return {
    cards: { ...board.cards, [card.id]: card },
    cardIdsByColumn: {
      ...board.cardIdsByColumn,
      [columnId]: [...(board.cardIdsByColumn[columnId] ?? []), card.id],
    },
  }
}

export function updateCard(
  board: BoardData,
  id: CardId,
  changes: Pick<Card, 'title' | 'description' | 'character'>,
): BoardData {
  const card = board.cards[id]
  if (!card) return board
  return { ...board, cards: { ...board.cards, [id]: { ...card, ...changes } } }
}

export function removeCard(board: BoardData, id: CardId): BoardData {
  const column = findColumnOf(board, id)
  if (!column) return board
  const cards = { ...board.cards }
  delete cards[id]
  return {
    cards,
    cardIdsByColumn: {
      ...board.cardIdsByColumn,
      [column]: board.cardIdsByColumn[column].filter((cardId) => cardId !== id),
    },
  }
}

export function isCompleteDraft(draft: CardDraft): draft is CompleteDraft {
  return draft.title.trim().length > 0 && draft.character !== null
}

// crypto.randomUUID is only available in secure contexts, so plain-http LAN access needs a fallback.
export function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
