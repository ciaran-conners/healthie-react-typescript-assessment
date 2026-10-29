import { useState } from 'react'
import { searchRickAndMorty } from './api/characters'
import { KanbanBoard } from './components/kanban/KanbanBoard'
import { loadBoard, saveBoard } from './persistence/boardStorage'

function App() {
  // Lazy so storage is only read once; the board treats it as an initial value anyway.
  const [initialBoard] = useState(loadBoard)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="bg-gradient-to-r from-portal via-morty to-portal bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          Interdimensional Kanban
        </h1>
        <p className="mt-1 text-slate-400">Delegate your tasks to anyone in the multiverse.</p>
      </header>
      <main>
        <KanbanBoard searchCharacters={searchRickAndMorty} initialBoard={initialBoard} onChange={saveBoard} />
      </main>
    </div>
  )
}

export default App
