import { useState } from 'react'
import { KanbanBoard } from './components/kanban/KanbanBoard'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { dangerButton, secondaryButton } from './components/ui/styles'
import { searchRickAndMorty } from './lib/api/characters'
import { clearBoard, loadBoard, saveBoard } from './lib/storage/boardStorage'
import type { BoardData } from './types'

function App() {
  // The board reads its starting data once, so recovering from a crash means remounting it with
  // fresh data: `generation` keys the error boundary, which remounts everything inside it.
  const [initialBoard, setInitialBoard] = useState(loadBoard)
  const [generation, setGeneration] = useState(0)

  const remount = (board: BoardData | undefined) => {
    setInitialBoard(board)
    setGeneration((g) => g + 1)
  }

  const clearAndRestart = () => {
    clearBoard()
    remount(undefined)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="bg-linear-to-r from-portal via-morty to-portal bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          Interdimensional Kanban
        </h1>
        <p className="mt-1 text-slate-400">Delegate your tasks to anyone in the multiverse.</p>
      </header>
      <main>
        <ErrorBoundary
          key={generation}
          fallback={
            <div role="alert" className="rounded-2xl bg-white/3 p-8 text-center ring-1 ring-white/10">
              <h2 className="text-lg font-semibold">Something went wrong with the board.</h2>
              <p className="mt-2 text-slate-400">
                Trying again usually fixes it. If it keeps happening, clearing the saved board will, but it
                deletes your cards.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => remount(loadBoard())} className={secondaryButton}>
                  Try again
                </button>
                <button type="button" onClick={clearAndRestart} className={dangerButton}>
                  Clear saved board
                </button>
              </div>
            </div>
          }
        >
          <KanbanBoard searchCharacters={searchRickAndMorty} initialBoard={initialBoard} onChange={saveBoard} />
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default App
