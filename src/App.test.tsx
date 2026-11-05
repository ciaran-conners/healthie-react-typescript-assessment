import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { BoardData } from './types'

const KEY = 'interdimensional-kanban:v1'

// The real board is covered by its own tests. This stub shows the board it was given, can report
// a change, and crashes on demand, which is all App's wiring needs.
vi.mock('./components/kanban/KanbanBoard', () => ({
  KanbanBoard: ({
    initialBoard,
    externalBoard,
    onChange,
  }: {
    initialBoard?: BoardData
    externalBoard?: BoardData
    onChange: (b: BoardData) => void
  }) => {
    const titles = Object.values((externalBoard ?? initialBoard)?.cards ?? {}).map((card) => card.title)
    if (titles.includes('Crash')) throw new Error('Board exploded')
    return (
      <div>
        <p>Board: {titles.join(', ') || 'empty'}</p>
        <button type="button" onClick={() => onChange(boardWith('Changed'))}>
          Change
        </button>
      </div>
    )
  },
}))

function boardWith(title: string): BoardData {
  return {
    cards: { a: { id: 'a', title, description: '', createdAt: 0, character: { id: '1', name: 'Rick', image: '' } } },
    cardIdsByColumn: { todo: ['a'], doing: [], done: [] },
  }
}

const save = (board: BoardData) => localStorage.setItem(KEY, JSON.stringify(board))

describe('App', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('starts from the saved board and saves changes', async () => {
    save(boardWith('Saved'))
    render(<App />)
    expect(screen.getByText('Board: Saved')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(JSON.parse(localStorage.getItem(KEY)!).cards.a.title).toBe('Changed')
  })

  it("passes another tab's save to the board, and an empty board if it was cleared", () => {
    render(<App />)
    expect(screen.getByText('Board: empty')).toBeInTheDocument()

    save(boardWith('From another tab'))
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: KEY })))
    expect(screen.getByText('Board: From another tab')).toBeInTheDocument()

    localStorage.clear()
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })))
    expect(screen.getByText('Board: empty')).toBeInTheDocument()
  })

  it('shows a fallback instead of a blank page when the board crashes, and can recover', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    save(boardWith('Crash'))
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('heading', { name: 'Interdimensional Kanban' })).toBeInTheDocument()

    // The saved data still crashes, so trying again lands back on the fallback.
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear saved board' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Board: empty')).toBeInTheDocument()
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
