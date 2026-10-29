export type CardId = string
export type ColumnId = string

/** The minimal character shape the board needs. Adapters map API data into this. */
export interface Character {
  id: string
  name: string
  image: string
  species?: string
}

export interface Card {
  id: CardId
  title: string
  description: string
  character: Character
  createdAt: number
}

export interface ColumnDef {
  id: ColumnId
  title: string
  /** Moving a card into this column triggers the celebration. */
  celebrate?: boolean
}

/** Everything that defines the board's content. This is what `onChange` emits. */
export interface BoardData {
  cards: Record<CardId, Card>
  cardIdsByColumn: Record<ColumnId, CardId[]>
}

export interface CardDraft {
  title: string
  description: string
  character: Character | null
}

export type CompleteDraft = CardDraft & { character: Character }

export interface Point {
  x: number
  y: number
}

export type SearchCharacters = (query: string, signal: AbortSignal) => Promise<Character[]>

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done', celebrate: true },
]
