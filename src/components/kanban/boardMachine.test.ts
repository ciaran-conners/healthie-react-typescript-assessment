import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { boardMachine, CELEBRATION_MS } from './boardMachine'
import { DEFAULT_COLUMNS, type CompleteDraft } from './types'

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
})
