import { describe, expect, it } from 'vitest'
import { addCard, findColumnOf, moveCard, normalizeBoard, removeCard } from './boardLogic'
import { DEFAULT_COLUMNS, type BoardData, type Card } from './types'

const rick = { id: '1', name: 'Rick Sanchez', image: 'rick.png' }

function card(id: string): Card {
  return { id, title: `Card ${id}`, description: '', character: rick, createdAt: 0 }
}

function board(layout: Record<string, string[]>): BoardData {
  const ids = Object.values(layout).flat()
  return {
    cards: Object.fromEntries(ids.map((id) => [id, card(id)])),
    cardIdsByColumn: { todo: [], doing: [], done: [], ...layout },
  }
}

describe('findColumnOf', () => {
  it('resolves both column ids and card ids', () => {
    const b = board({ todo: ['a'], doing: ['b'] })
    expect(findColumnOf(b, 'doing')).toBe('doing')
    expect(findColumnOf(b, 'a')).toBe('todo')
    expect(findColumnOf(b, 'missing')).toBeUndefined()
  })
})

describe('moveCard', () => {
  it('reorders within a column', () => {
    const b = board({ todo: ['a', 'b', 'c'] })
    expect(moveCard(b, 'a', 'c').cardIdsByColumn.todo).toEqual(['b', 'c', 'a'])
    expect(moveCard(b, 'c', 'a').cardIdsByColumn.todo).toEqual(['c', 'a', 'b'])
  })

  it('moves across columns into the slot of the card it is over', () => {
    const next = moveCard(board({ todo: ['a', 'b'], doing: ['x', 'y'] }), 'a', 'y')
    expect(next.cardIdsByColumn.todo).toEqual(['b'])
    expect(next.cardIdsByColumn.doing).toEqual(['x', 'a', 'y'])
  })

  it('appends when dropped on a column, including an empty one', () => {
    const next = moveCard(board({ todo: ['a', 'b'] }), 'a', 'done')
    expect(next.cardIdsByColumn.todo).toEqual(['b'])
    expect(next.cardIdsByColumn.done).toEqual(['a'])
  })

  it('returns the same reference when nothing changes', () => {
    const b = board({ todo: ['a', 'b'] })
    expect(moveCard(b, 'a', 'a')).toBe(b)
    expect(moveCard(b, 'a', 'nowhere')).toBe(b)
  })
})

describe('addCard / removeCard', () => {
  it('adds to the end of a column and removes cleanly', () => {
    const added = addCard(board({ todo: ['a'] }), card('b'), 'todo')
    expect(added.cardIdsByColumn.todo).toEqual(['a', 'b'])
    const removed = removeCard(added, 'a')
    expect(removed.cardIdsByColumn.todo).toEqual(['b'])
    expect(removed.cards.a).toBeUndefined()
  })
})

describe('normalizeBoard', () => {
  it('drops dangling ids, adds missing columns and rehomes orphaned cards', () => {
    const stale: BoardData = {
      cards: { a: card('a'), b: card('b') },
      cardIdsByColumn: { todo: ['ghost'], archived: ['b'], doing: ['a'] },
    }
    expect(normalizeBoard(DEFAULT_COLUMNS, stale).cardIdsByColumn).toEqual({
      todo: ['b'],
      doing: ['a'],
      done: [],
    })
  })
})
