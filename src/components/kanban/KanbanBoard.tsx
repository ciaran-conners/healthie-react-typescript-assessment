import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMachine } from '@xstate/react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { BoardColumn } from './BoardColumn'
import { CardView } from './BoardCard'
import { findColumnOf } from './boardLogic'
import { boardMachine, type Point } from './boardMachine'
import { CardForm } from './CardForm'
import { Modal } from './Modal'
import { dangerButton, secondaryButton } from './styles'
import { DEFAULT_COLUMNS, type BoardData, type ColumnDef, type SearchCharacters } from './types'

export interface KanbanBoardProps {
  /** Injected data source for the character picker; the board knows nothing about the API behind it. */
  searchCharacters: SearchCharacters
  /** Read once on mount, like `defaultValue`. */
  columns?: ColumnDef[]
  /** Read once on mount, like `defaultValue`. */
  initialBoard?: BoardData
  /** Called with the full board after every committed change (not on every drag frame). */
  onChange?: (board: BoardData) => void
}

function dropOrigin(event: DragEndEvent): Point | null {
  const rect = event.active.rect.current.translated
  return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
}

export function KanbanBoard({
  searchCharacters,
  columns = DEFAULT_COLUMNS,
  initialBoard,
  onChange,
}: KanbanBoardProps) {
  const [snapshot, send, actorRef] = useMachine(boardMachine, { input: { columns, board: initialBoard } })
  const { board, activeId, editingId, deletingId, celebration } = snapshot.context
  const columnDefs = snapshot.context.columns

  const isIdle = snapshot.matches({ interaction: 'idle' })
  const isDragging = snapshot.matches({ interaction: 'dragging' })
  // Editing and confirming a delete lock the board; dragging only locks the card actions.
  const dragLocked = !isIdle && !isDragging

  // Emit committed board changes. Mid-drag previews are skipped; a cancelled drag restores
  // the original reference, so it produces no emission either.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  useEffect(() => {
    let last = actorRef.getSnapshot().context.board
    const subscription = actorRef.subscribe((next) => {
      if (next.matches({ interaction: 'dragging' }) || next.context.board === last) return
      last = next.context.board
      onChangeRef.current?.(last)
    })
    return () => subscription.unsubscribe()
  }, [actorRef])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const titleOf = (id: UniqueIdentifier) => `“${board.cards[String(id)]?.title ?? 'card'}”`
  const columnTitleOf = (id: UniqueIdentifier) =>
    columnDefs.find((column) => column.id === findColumnOf(board, String(id)))?.title ?? 'the board'
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)} is over ${columnTitleOf(over.id)}.` : `${titleOf(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} dropped in ${columnTitleOf(over.id)}.` : `${titleOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
  }

  const activeCard = activeId ? board.cards[activeId] : null
  const editingCard = editingId ? board.cards[editingId] : null
  const deletingCard = deletingId ? board.cards[deletingId] : null
  const cardCount = Object.keys(board.cards).length

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <section
        aria-labelledby="new-card-heading"
        className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 lg:sticky lg:top-6"
      >
        <h2 id="new-card-heading" className="mb-4 text-lg font-semibold">
          New card
        </h2>
        <CardForm
          submitLabel="Add to To Do"
          searchCharacters={searchCharacters}
          onSubmit={(draft) => send({ type: 'CREATE', draft })}
          resetOnSubmit
          disabled={!isIdle}
        />
      </section>

      <div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          accessibility={{ announcements }}
          onDragStart={({ active }) => send({ type: 'DRAG_START', cardId: String(active.id) })}
          onDragOver={({ over }) => over && send({ type: 'DRAG_OVER', overId: String(over.id) })}
          onDragEnd={(event) =>
            send({ type: 'DRAG_END', overId: event.over ? String(event.over.id) : null, origin: dropOrigin(event) })
          }
          onDragCancel={() => send({ type: 'DRAG_CANCEL' })}
        >
          <div
            className="grid gap-4 md:grid-cols-[repeat(var(--column-count),minmax(0,1fr))]"
            style={{ '--column-count': columnDefs.length } as CSSProperties}
          >
            {columnDefs.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                cards={board.cardIdsByColumn[column.id].map((id) => board.cards[id])}
                isDropTarget={isDragging && !!activeId && board.cardIdsByColumn[column.id].includes(activeId)}
                celebratingCardId={celebration?.cardId ?? null}
                dragDisabled={dragLocked}
                actionsDisabled={!isIdle}
                onEdit={(cardId) => send({ type: 'EDIT', cardId })}
                onDelete={(cardId) => send({ type: 'DELETE', cardId })}
              />
            ))}
          </div>

          <DragOverlay>{activeCard && <CardView card={activeCard} overlay />}</DragOverlay>
        </DndContext>

        {cardCount === 0 && (
          <p className="mt-4 text-center text-sm text-slate-500">
            No cards yet. Create one and assign it to someone from the multiverse.
          </p>
        )}
      </div>

      {editingCard && (
        <Modal title="Edit card" onClose={() => send({ type: 'CANCEL' })}>
          <CardForm
            submitLabel="Save changes"
            searchCharacters={searchCharacters}
            initialDraft={editingCard}
            onSubmit={(draft) => send({ type: 'SAVE', draft })}
            onCancel={() => send({ type: 'CANCEL' })}
            autoFocus
          />
        </Modal>
      )}

      {deletingCard && (
        <Modal title="Delete card?" onClose={() => send({ type: 'CANCEL' })}>
          <p className="mb-6 text-slate-300">
            “{deletingCard.title}” will be sent to a dimension it can’t come back from.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" autoFocus onClick={() => send({ type: 'CANCEL' })} className={secondaryButton}>
              Cancel
            </button>
            <button type="button" onClick={() => send({ type: 'CONFIRM' })} className={dangerButton}>
              Delete
            </button>
          </div>
        </Modal>
      )}

    </div>
  )
}
