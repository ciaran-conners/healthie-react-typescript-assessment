# Interdimensional Kanban

**Live demo: https://ciaran-martin-conners-kanban.vercel.app**

A frontend-only Kanban board (To Do / Doing / Done) where every card is assigned a character from the
[Rick and Morty GraphQL API](https://rickandmortyapi.com/graphql). You can create, edit and delete
cards, drag them between columns and reorder them within a column. Moving a card into **Done** sets
off a confetti burst from the spot where it landed.

## Getting started

Requires Node `^20.19` or `>=22.12`.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | |
| --- | --- |
| `npm test` | Vitest in watch mode (`npm test -- --run` for a single run) |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run build` | typecheck + production build |

## The brief, and where each requirement lives

| Requirement | Implementation |
| --- | --- |
| Three columns: To Do, Doing, Done | Columns are data (`DEFAULT_COLUMNS` in `types.ts`), rendered by `BoardColumn` |
| Fetch characters from the Rick and Morty GraphQL API | `api/gql.ts` + `api/characters.ts`, used for a debounced, cancellable search in `CharacterPicker` |
| Items created via a form, each with a character | `CardForm` validates that a title and a character are present; the machine checks again as a backstop |
| Draggable between columns, reorderable within one | dnd-kit sortable contexts per column; the pure `moveCard` in `boardLogic.ts` |
| Something delightful on Done | CSS-only confetti plus a portal ring from the drop point, and a glow on the card |
| React + TypeScript | React 19, TypeScript in strict mode |

## Using the board

- **Create** a card with the form on the left. Search for a character by name and pick one from the list.
- **Drag** a card with the mouse from anywhere on it. On touch screens, long-press, so normal swiping
  still scrolls. With the keyboard, focus the grip handle, press Space to pick it up, use the arrow keys
  to move it, Space to drop and Escape to cancel.
- **Edit or delete** a card with the buttons that appear on hover or focus (always visible on touch).
- The board is saved to `localStorage` and restored on reload.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Build | Vite | No backend needed, so no framework overhead |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Headless, with mouse, touch and keyboard sensors and screen-reader announcements; the app owns the data |
| State | XState v5 | The board has mutually exclusive modes (see below) |
| Data fetching | `fetch` + a small typed `gql()` helper | A single read-only query; a GraphQL client's cache would compete with the machine as a source of truth |
| Styling | Tailwind CSS v4 | |
| Celebration | Pure CSS keyframes | No dependency; respects `prefers-reduced-motion` |
| Tests | Vitest + React Testing Library | |

## Architecture

```
src/
  App.tsx                         connects the board to the API adapter and localStorage
  api/
    gql.ts                        generic typed GraphQL-over-fetch helper
    characters.ts                 Rick and Morty adapter implementing SearchCharacters, with a cache
  persistence/
    boardStorage.ts               load/save, validating untrusted stored data before use
  components/kanban/
    KanbanBoard.tsx               the public component
    boardMachine.ts               XState machine: interaction modes, celebration, card data
    boardLogic.ts                 pure board operations (move, add, update, remove, normalize)
    types.ts                      domain types and default columns
    CardForm.tsx                  shared create/edit form
    CharacterPicker.tsx           combobox for choosing a character
    useCharacterSearch.ts         debounced, cancellable search hook
    BoardColumn.tsx, BoardCard.tsx, Modal.tsx, Confetti.tsx
```

### A self-contained component with an injected data source

```tsx
<KanbanBoard
  searchCharacters={searchRickAndMorty} // (query, signal) => Promise<Character[]>
  initialBoard={loadBoard()}            // optional, read once (like defaultValue)
  onChange={saveBoard}                  // optional, receives the full board after each committed change
  columns={DEFAULT_COLUMNS}             // optional, read once
/>
```

The board owns its interaction state and knows nothing about Rick and Morty, GraphQL or localStorage.
That keeps it testable (tests pass a fake `searchCharacters`, so there's no network mocking), and it
means "use a different API" or "persist to a server" is a change of props, not of the component.

The board is **uncontrolled**: it starts from `initialBoard` and reports changes through `onChange`.
`onChange` always sends the *full* board, never a diff, and only for committed changes: not on every
frame of a drag, and not for a drag that was cancelled. Sending the full board is deliberate. A future
controlled mode (`cards` + `onChange`, where the parent owns the data) can reuse the same contract,
so adding it doesn't require a rewrite.

### Why a state machine

The board's modes rule each other out: you can't drag while editing, edit while dragging, or create
while confirming a delete. With a reducer that's a set of booleans and hand-written guards. With the
machine, an event the current state doesn't handle is simply ignored.

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

- **Celebration runs in parallel**, so the confetti never blocks the next interaction. Reordering
  within Done doesn't celebrate again.
- **The machine decides *when*, `boardLogic.ts` decides *what*.** Card data lives in the machine's
  context, but every change to it goes through a pure function, so the logic can be unit-tested
  without the machine.
- **One XState detail worth knowing:** exit actions run *before* transition actions. So cleanup (such
  as clearing `editingId`) happens at the end of each transition rather than on exit, where it would
  wipe values the transition still needs.

### Data fetching

- `gql()` turns both HTTP failures and GraphQL errors into thrown errors. GraphQL usually reports
  errors as a 200 response with an `errors` array, which a plain `res.ok` check would miss.
- The search waits for a pause in typing, cancels requests that are no longer relevant with an
  `AbortController`, and treats a search as loading until results for the *current* text arrive, so
  a slow, older response can never overwrite a newer one.
- The adapter caches results by query, so reopening the picker or repeating a search is instant.

### Accessibility

- Keyboard dragging through the grip handle, with announcements naming the card and column.
- The character picker follows the ARIA 1.2 combobox pattern (arrow keys, Enter, Escape). Loading,
  empty and error states are announced, and "Try again" can be reached with Tab.
- Modals move focus to their first field, trap it by marking the rest of the page `inert`
  (unfocusable, unclickable and hidden from assistive technology), and return it to the control that
  opened them. `inert` is the platform-native version of what dialog libraries do with focus guards
  and `aria-hidden`; native `<dialog>` or Radix Dialog would be equally valid choices.
- Completing a card is announced in a live region.
- Under `prefers-reduced-motion`, the confetti is replaced by a static glow on the card.

### Robustness

- Saved boards are validated card by card before use, and reconciled with the current columns
  (unknown ids are dropped, and cards without a column go to the first one), so old or corrupted
  data can't crash the page.
- Card ids fall back from `crypto.randomUUID`, which only exists on HTTPS or localhost, so the app
  also works when opened over a plain-HTTP LAN address (for example, on a phone).

## Testing

```bash
npm test -- --run
```

- **`boardLogic.test.ts`:** moving, reordering, dropping onto empty columns and normalizing saved data.
- **`boardMachine.test.ts`:** each mode and transition, including the actions each mode must ignore
  (e.g. editing while dragging), cancel restoring the board, and when a celebration should and
  shouldn't fire.
- **`KanbanBoard.test.tsx`:** the UI with a fake character search: creating, validating, editing,
  deleting, focus handling in modals, the focus trap, restoring a saved board and retrying a failed
  search.
- **`boardStorage.test.ts`:** saving and loading, and rejecting malformed or corrupted data.

The drag gestures themselves aren't reliable to simulate in jsdom, so the move logic is tested
through the machine and `boardLogic`, and mouse, touch and keyboard dragging were checked by hand in
a real browser.

## Trade-offs and possible next steps

- **Controlled mode** (`cards` prop) for parent-owned state, undo/redo or server sync.
- **The character picker shows the first page of results** (20 per query). Pagination or infinite
  scroll would fit in the adapter, which is also where TanStack Query would go if caching needs grew.
- **The search cache is unbounded.** That's fine for one session of name searches, but it would want
  an LRU limit in a long-lived app.
- **Filtering** the board by character or species.
- In browsers older than spring 2023, `inert` has no effect. Modals still work there, just without the
  focus trap.
