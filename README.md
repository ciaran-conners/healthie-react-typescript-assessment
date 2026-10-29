# Interdimensional Kanban

A frontend-only Kanban board (To Do / Doing / Done) where every card is assigned a character from the
[Rick and Morty GraphQL API](https://rickandmortyapi.com/graphql). Cards can be created, edited, deleted,
dragged between columns and reordered within a column, and moving one into **Done** sets off a confetti
burst from the spot where it landed.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest + React Testing Library
npm run build      # typecheck + production build
```

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Build | Vite + React 19 + TypeScript (strict) | No backend needed, so no framework overhead |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Headless, pointer/touch/keyboard sensors, screen-reader announcements; the app owns the data |
| State | XState v5 | The board has mutually exclusive modes (see below) |
| Data fetching | `fetch` + a small typed `gql()` helper | One read-only query; a GraphQL client's cache would compete with the machine as a source of truth |
| Styling | Tailwind CSS v4 | |
| Celebration | Pure CSS keyframes | No dependency; respects `prefers-reduced-motion` |
| Tests | Vitest + React Testing Library | |

## Architecture

```
src/
  App.tsx                         wires the board to the API adapter and localStorage
  api/
    gql.ts                        typed GraphQL-over-fetch helper (HTTP + GraphQL errors → throws)
    characters.ts                 Rick and Morty adapter: SearchCharacters implementation + cache
  persistence/boardStorage.ts     load/save with shape validation
  components/kanban/
    KanbanBoard.tsx               the public component
    boardMachine.ts               XState machine: modes + card data
    boardLogic.ts                 pure board operations (move, add, update, remove, normalize)
    CardForm.tsx / CharacterPicker.tsx / useCharacterSearch.ts
    BoardColumn.tsx / BoardCard.tsx / Modal.tsx / Confetti.tsx
```

### A self-contained component with injected data access

```tsx
<KanbanBoard
  searchCharacters={searchRickAndMorty} // (query, signal) => Promise<Character[]>
  initialBoard={loadBoard()}            // optional, read once (like defaultValue)
  onChange={saveBoard}                  // optional, receives the full board after each change
  columns={DEFAULT_COLUMNS}             // optional, columns are data
/>
```

The board owns its interaction state and knows nothing about Rick and Morty, GraphQL or localStorage.
That keeps it testable (tests pass a fake `searchCharacters`, so there's no network mocking) and makes
"use a different API" or "persist to a server" a change to props, not to the component.

The board is **uncontrolled**: it starts from `initialBoard` and reports changes through `onChange`.
`onChange` always emits the *full* board snapshot, never a diff. That's deliberate, because a future
controlled mode (`cards` + `onChange`, where the parent owns the data) can reuse the same contract,
which makes it an additive change rather than a rewrite.

### Why a state machine

The board's modes rule each other out: you can't drag while editing, edit while dragging, or create
while confirming a delete. With a reducer that's a set of booleans and hand-written guards; with the
machine, an event that a state doesn't handle is simply ignored.

```
board (parallel)
├── interaction
│   ├── idle              CREATE · DRAG_START → dragging · EDIT → editing · DELETE → confirmingDelete
│   ├── dragging          DRAG_OVER (live cross-column move) · DRAG_END → idle · DRAG_CANCEL → idle (restore)
│   ├── editing           SAVE → idle · CANCEL → idle
│   └── confirmingDelete  CONFIRM → idle · CANCEL → idle
└── celebration
    ├── quiet             CELEBRATE (guard: card *arrived* in a celebrate column) → celebrating
    └── celebrating       after 1.8s → quiet
```

Celebration is a parallel region so the confetti never blocks the next interaction. The card data lives
in the machine context, and the actual operations are pure functions in `boardLogic.ts`, so the machine
handles *when* things may happen and `boardLogic.ts` handles *what* happens.

### Accessibility

- Cards can be dragged with the keyboard via the grip handle (Space to pick up, arrows to move, Space to
  drop, Escape to cancel), with custom announcements naming the card and column.
- The character picker is an ARIA 1.2 combobox (arrow keys, Enter, Escape).
- Modals trap focus by marking the rest of the page `inert` (unfocusable, unclickable and hidden from
  assistive tech), and restore focus to the control that opened them.
- Completing a card is announced in a live region.
- Under `prefers-reduced-motion`, the confetti is replaced by a static glow on the card.

## Possible next steps

- Controlled mode (`cards` prop) for parent-owned state, undo/redo or server sync.
- Pagination / infinite scroll in the character picker (the adapter is the place for TanStack Query).
- Filtering the board by character or species.
