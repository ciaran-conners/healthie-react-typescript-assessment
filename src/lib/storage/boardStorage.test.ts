import { beforeEach, describe, expect, it } from 'vitest'
import type { BoardData } from '../../types'
import { loadBoard, saveBoard } from './boardStorage'

const board: BoardData = {
  cards: {
    a: { id: 'a', title: 'Card', description: '', createdAt: 0, character: { id: '1', name: 'Rick', image: 'r.png' } },
  },
  cardIdsByColumn: { todo: ['a'], doing: [], done: [] },
}

describe('boardStorage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a board', () => {
    saveBoard(board)
    expect(loadBoard()).toEqual(board)
  })

  it('rejects malformed or corrupted data instead of crashing', () => {
    localStorage.setItem('interdimensional-kanban:v1', '{not json')
    expect(loadBoard()).toBeUndefined()

    const corrupted = { ...board, cards: { a: { ...board.cards.a, character: null } } }
    localStorage.setItem('interdimensional-kanban:v1', JSON.stringify(corrupted))
    expect(loadBoard()).toBeUndefined()
  })
})
