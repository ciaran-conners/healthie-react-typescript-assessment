import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import type { BoardData, CompleteDraft } from '../../types'
import { boardMachine, CELEBRATION_MS } from './boardMachine'
import { DEFAULT_COLUMNS } from './columns'

const rick = { id: '1', name: 'Rick Sanchez', image: 'rick.png' }
const draft = (title: string): CompleteDraft => ({ title, description: '', character: rick })

function startBoard() {
  const actor = createActor(boardMachine, { input: { columns: DEFAULT_COLUMNS } }).start()
  const create = (title: string) => {
    actor.send({ type: 'CREATE', draft: draft(title) })
    const { cardIdsByColumn } = actor.getSnapshot().context.board
    return cardIdsByColumn.todo[cardIdsByColumn.todo.length - 1]
  }
  return { actor, create, columns: () => actor.getSnapshot().context.board.cardIdsByColumn }
}

describe('boardMachine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('creates cards in the first column and rejects incomplete drafts', () => {
    const { actor, create, columns } = startBoard()
    create('Get Schwifty')
    actor.send({ type: 'CREATE', draft: { title: '  ', description: '', character: rick } })
    // Bypasses the type system on purpose: the guard is the runtime backstop.
    actor.send({ type: 'CREATE', draft: { title: 'No character', description: '', character: null } as never })
    expect(columns().todo).toHaveLength(1)
  })

  it('moves a card across columns on drop', () => {
    const { actor, create, columns } = startBoard()
    const id = create('Pass the butter')
    actor.send({ type: 'DRAG_START', cardId: id })
    actor.send({ type: 'DRAG_OVER', overId: 'doing' })
    actor.send({ type: 'DRAG_END', overId: 'doing', origin: null })
    expect(columns()).toMatchObject({ todo: [], doing: [id] })
    expect(actor.getSnapshot().matches({ interaction: 'idle' })).toBe(true)
  })

  it('restores the board when a drag is cancelled', () => {
    const { actor, create, columns } = startBoard()
    const id = create('Wubba lubba')
    actor.send({ type: 'DRAG_START', cardId: id })
    actor.send({ type: 'DRAG_OVER', overId: 'done' })
    expect(columns().done).toEqual([id])
    actor.send({ type: 'DRAG_CANCEL' })
    expect(columns()).toMatchObject({ todo: [id], done: [] })
  })

  it('celebrates when a card arrives in Done, then calms down by itself', () => {
    const { actor, create } = startBoard()
    const id = create('Save the multiverse')
    actor.send({ type: 'DRAG_START', cardId: id })
    actor.send({ type: 'DRAG_OVER', overId: 'done' })
    actor.send({ type: 'DRAG_END', overId: 'done', origin: { x: 10, y: 20 } })

    const snapshot = actor.getSnapshot()
    expect(snapshot.matches({ celebration: 'celebrating' })).toBe(true)
    expect(snapshot.context.celebration).toMatchObject({ cardId: id, origin: { x: 10, y: 20 } })

    vi.advanceTimersByTime(CELEBRATION_MS)
    expect(actor.getSnapshot().matches({ celebration: 'quiet' })).toBe(true)
  })

  it('does not celebrate reordering inside Done', () => {
    const { actor, create } = startBoard()
    const a = create('A')
    const b = create('B')
    for (const id of [a, b]) {
      actor.send({ type: 'DRAG_START', cardId: id })
      actor.send({ type: 'DRAG_END', overId: 'done', origin: null })
    }
    vi.advanceTimersByTime(CELEBRATION_MS)

    actor.send({ type: 'DRAG_START', cardId: a })
    actor.send({ type: 'DRAG_END', overId: b, origin: null })
    expect(actor.getSnapshot().context.board.cardIdsByColumn.done).toEqual([b, a])
    expect(actor.getSnapshot().matches({ celebration: 'quiet' })).toBe(true)
  })

  it('does not block interaction while celebrating', () => {
    const { actor, create } = startBoard()
    const id = create('Celebrate')
    actor.send({ type: 'DRAG_START', cardId: id })
    actor.send({ type: 'DRAG_END', overId: 'done', origin: null })
    actor.send({ type: 'EDIT', cardId: id })
    expect(actor.getSnapshot().matches({ interaction: 'editing', celebration: 'celebrating' })).toBe(true)
  })

  it('edits a card and ignores drag and delete attempts meanwhile', () => {
    const { actor, create } = startBoard()
    const id = create('Old title')
    actor.send({ type: 'EDIT', cardId: id })
    actor.send({ type: 'DRAG_START', cardId: id })
    actor.send({ type: 'DELETE', cardId: id })
    expect(actor.getSnapshot().matches({ interaction: 'editing' })).toBe(true)

    actor.send({ type: 'SAVE', draft: draft('New title') })
    const { context } = actor.getSnapshot()
    expect(context.board.cards[id].title).toBe('New title')
    expect(context.editingId).toBeNull()
    expect(actor.getSnapshot().matches({ interaction: 'idle' })).toBe(true)
  })

  it('ignores edits and new cards while dragging', () => {
    const { actor, create, columns } = startBoard()
    const id = create('Dragged')
    actor.send({ type: 'DRAG_START', cardId: id })
    actor.send({ type: 'EDIT', cardId: id })
    actor.send({ type: 'CREATE', draft: draft('Sneaky') })
    expect(actor.getSnapshot().matches({ interaction: 'dragging' })).toBe(true)
    expect(columns().todo).toEqual([id])
  })

  it('only deletes after confirmation', () => {
    const { actor, create, columns } = startBoard()
    const id = create('Doomed')
    actor.send({ type: 'DELETE', cardId: id })
    actor.send({ type: 'CANCEL' })
    expect(columns().todo).toEqual([id])

    actor.send({ type: 'DELETE', cardId: id })
    actor.send({ type: 'CONFIRM' })
    expect(columns().todo).toEqual([])
    expect(actor.getSnapshot().context.deletingId).toBeNull()
  })

  describe('updates from another tab', () => {
    // What another tab would save: this board's cards, changed by `change`.
    function externalBoard(actor: ReturnType<typeof startBoard>['actor'], change: (board: BoardData) => BoardData) {
      return change(structuredClone(actor.getSnapshot().context.board))
    }
    const withTitle = (id: string, title: string) => (board: BoardData) => {
      board.cards[id].title = title
      return board
    }
    const without = (id: string) => (board: BoardData) => {
      delete board.cards[id]
      board.cardIdsByColumn.todo = board.cardIdsByColumn.todo.filter((other) => other !== id)
      return board
    }

    it('replaces the board when idle, filling in missing columns', () => {
      const { actor } = startBoard()
      actor.send({ type: 'EXTERNAL_UPDATE', board: { cards: {}, cardIdsByColumn: {} } })
      expect(actor.getSnapshot().context.board.cardIdsByColumn).toEqual({ todo: [], doing: [], done: [] })
    })

    it('keeps an open editor open, and saves onto the newer board', () => {
      const { actor, create } = startBoard()
      const edited = create('Being edited')
      const other = create('Other')
      actor.send({ type: 'EDIT', cardId: edited })
      actor.send({ type: 'EXTERNAL_UPDATE', board: externalBoard(actor, withTitle(other, 'Renamed elsewhere')) })
      expect(actor.getSnapshot().matches({ interaction: 'editing' })).toBe(true)

      actor.send({ type: 'SAVE', draft: draft('Saved here') })
      const { cards } = actor.getSnapshot().context.board
      expect(cards[edited].title).toBe('Saved here')
      expect(cards[other].title).toBe('Renamed elsewhere')
    })

    it('closes the editor or delete prompt when that card was deleted elsewhere', () => {
      const { actor, create } = startBoard()
      const id = create('Gone')
      actor.send({ type: 'EDIT', cardId: id })
      actor.send({ type: 'EXTERNAL_UPDATE', board: externalBoard(actor, without(id)) })
      expect(actor.getSnapshot().matches({ interaction: 'idle' })).toBe(true)
      expect(actor.getSnapshot().context.editingId).toBeNull()

      const next = create('Also gone')
      actor.send({ type: 'DELETE', cardId: next })
      actor.send({ type: 'EXTERNAL_UPDATE', board: externalBoard(actor, without(next)) })
      expect(actor.getSnapshot().matches({ interaction: 'idle' })).toBe(true)
      expect(actor.getSnapshot().context.deletingId).toBeNull()
    })

    it('holds an update until a drag ends, then replays the drop onto it', () => {
      const { actor, create, columns } = startBoard()
      const dragged = create('Dragged')
      const other = create('Other')
      actor.send({ type: 'DRAG_START', cardId: dragged })
      actor.send({ type: 'DRAG_OVER', overId: 'doing' })
      actor.send({ type: 'EXTERNAL_UPDATE', board: externalBoard(actor, withTitle(other, 'Renamed elsewhere')) })
      // Still mid-drag: the board under the pointer hasn't changed.
      expect(columns().doing).toEqual([dragged])

      actor.send({ type: 'DRAG_END', overId: 'doing', origin: null })
      const { board } = actor.getSnapshot().context
      expect(board.cardIdsByColumn).toMatchObject({ todo: [other], doing: [dragged] })
      expect(board.cards[other].title).toBe('Renamed elsewhere')
    })

    it('uses the held update when a drag is cancelled', () => {
      const { actor, create } = startBoard()
      const id = create('Dragged')
      actor.send({ type: 'DRAG_START', cardId: id })
      actor.send({ type: 'EXTERNAL_UPDATE', board: externalBoard(actor, withTitle(id, 'Renamed elsewhere')) })
      actor.send({ type: 'DRAG_CANCEL' })
      expect(actor.getSnapshot().context.board.cards[id].title).toBe('Renamed elsewhere')
    })
  })

  it('tags each mode with the controls it locks', () => {
    const { actor, create } = startBoard()
    const id = create('Tagged')
    const locks = () => ({
      cardActions: actor.getSnapshot().hasTag('cardActionsLocked'),
      drag: actor.getSnapshot().hasTag('dragLocked'),
    })
    expect(locks()).toEqual({ cardActions: false, drag: false })

    actor.send({ type: 'DRAG_START', cardId: id })
    expect(locks()).toEqual({ cardActions: true, drag: false })
    actor.send({ type: 'DRAG_CANCEL' })

    actor.send({ type: 'EDIT', cardId: id })
    expect(locks()).toEqual({ cardActions: true, drag: true })
    actor.send({ type: 'CANCEL' })

    actor.send({ type: 'DELETE', cardId: id })
    expect(locks()).toEqual({ cardActions: true, drag: true })
  })
})
