import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { KanbanBoard } from './KanbanBoard'
import type { BoardData, Character, SearchCharacters } from './types'

const CHARACTERS: Character[] = [
  { id: '1', name: 'Rick Sanchez', image: 'rick.png', species: 'Human' },
  { id: '2', name: 'Morty Smith', image: 'morty.png', species: 'Human' },
  { id: '3', name: 'Mr. Poopybutthole', image: 'poopy.png', species: 'Poopybutthole' },
]

const fakeSearch: SearchCharacters = async (query) =>
  CHARACTERS.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

function renderBoard(props: Partial<Parameters<typeof KanbanBoard>[0]> = {}) {
  const onChange = vi.fn<(board: BoardData) => void>()
  const user = userEvent.setup()
  render(<KanbanBoard searchCharacters={fakeSearch} onChange={onChange} {...props} />)
  const column = (name: string) => within(screen.getByRole('region', { name }))
  return { user, onChange, column }
}

async function createCard(user: ReturnType<typeof userEvent.setup>, title: string, characterQuery: string) {
  const form = within(screen.getByRole('region', { name: 'New card' }))
  await user.type(form.getByLabelText('Title'), title)
  await user.type(form.getByRole('combobox'), characterQuery)
  await user.click(await form.findByRole('option', { name: new RegExp(characterQuery, 'i') }))
  await user.click(form.getByRole('button', { name: 'Add to To Do' }))
}

describe('KanbanBoard', () => {
  it('renders the three columns', () => {
    renderBoard()
    for (const name of ['To Do', 'Doing', 'Done']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('creates a card with an assigned character and reports the change', async () => {
    const { user, onChange, column } = renderBoard()
    await createCard(user, 'Pass the butter', 'morty')

    const card = column('To Do').getByRole('listitem')
    expect(within(card).getByText('Pass the butter')).toBeInTheDocument()
    expect(within(card).getByText(/Morty Smith/)).toBeInTheDocument()

    const emitted = onChange.mock.lastCall![0]
    const [id] = emitted.cardIdsByColumn.todo
    expect(emitted.cards[id]).toMatchObject({ title: 'Pass the butter', character: { name: 'Morty Smith' } })
  })

  it('requires a title and a character', async () => {
    const { user, onChange } = renderBoard()
    await user.click(screen.getByRole('button', { name: 'Add to To Do' }))

    expect(screen.getByText('Give the card a title.')).toBeInTheDocument()
    expect(screen.getByText('Every card needs a Rick and Morty character.')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('edits a card, locking the board while the editor is open', async () => {
    const { user, column } = renderBoard()
    await createCard(user, 'Old title', 'rick')

    await user.click(screen.getByRole('button', { name: 'Edit “Old title”' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Edit card' }))
    expect(screen.getByRole('button', { name: 'Delete “Old title”' })).toBeDisabled()

    const title = dialog.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'New title')
    await user.click(dialog.getByRole('button', { name: 'Change' }))
    await user.type(dialog.getByRole('combobox'), 'poopy')
    await user.click(await dialog.findByRole('option', { name: /Poopybutthole/ }))
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit “New title”' })).toHaveFocus()
    const card = column('To Do').getByRole('listitem')
    expect(within(card).getByText('New title')).toBeInTheDocument()
    expect(within(card).getByText(/Mr\. Poopybutthole/)).toBeInTheDocument()
  })

  it('deletes a card only after confirmation', async () => {
    const { user, column } = renderBoard()
    await createCard(user, 'Doomed', 'rick')

    await user.click(screen.getByRole('button', { name: 'Delete “Doomed”' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(column('To Do').getByText('Doomed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete “Doomed”' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(column('To Do').queryByText('Doomed')).not.toBeInTheDocument()
  })

  it('restores an initial board', () => {
    const initialBoard: BoardData = {
      cards: { a: { id: 'a', title: 'Saved card', description: '', character: CHARACTERS[0], createdAt: 0 } },
      cardIdsByColumn: { todo: [], doing: [], done: ['a'] },
    }
    const { column } = renderBoard({ initialBoard })
    expect(column('Done').getByText('Saved card')).toBeInTheDocument()
  })

  it('shows a retry option when the character search fails', async () => {
    const search = vi
      .fn<SearchCharacters>()
      .mockRejectedValueOnce(new Error('Portal gun out of fluid'))
      .mockImplementation(fakeSearch)
    const { user } = renderBoard({ searchCharacters: search })

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('option', { name: /Rick Sanchez/ })).toBeInTheDocument()
  })
})
