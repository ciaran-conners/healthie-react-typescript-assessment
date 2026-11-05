import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardData } from '../../types'
import { clearBoard, loadBoard, saveBoard, subscribeToOtherTabs } from './boardStorage'

const KEY = 'interdimensional-kanban:v1'

const board: BoardData = {
  cards: {
    a: { id: 'a', title: 'Card', description: '', createdAt: 0, character: { id: '1', name: 'Rick', image: 'r.png' } },
  },
  cardIdsByColumn: { todo: ['a'], doing: [], done: [] },
}

describe('boardStorage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('round-trips a board', () => {
    saveBoard(board)
    expect(loadBoard()).toEqual(board)
  })

  it('rejects malformed or corrupted data instead of crashing', () => {
    localStorage.setItem(KEY, '{not json')
    expect(loadBoard()).toBeUndefined()

    const corrupted = { ...board, cards: { a: { ...board.cards.a, character: null } } }
    localStorage.setItem(KEY, JSON.stringify(corrupted))
    expect(loadBoard()).toBeUndefined()
  })

  it('clears the saved board', () => {
    saveBoard(board)
    clearBoard()
    expect(loadBoard()).toBeUndefined()
  })


  it('notifies about other tabs changing the board, and nothing else', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToOtherTabs(onChange)

    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }))
    expect(onChange).not.toHaveBeenCalled()
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(onChange).toHaveBeenCalledTimes(2)

    unsubscribe()
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
