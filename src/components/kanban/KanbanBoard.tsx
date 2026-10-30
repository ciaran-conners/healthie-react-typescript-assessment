import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMachine } from '@xstate/react'
import { useEffect, useEffectEvent, useId, type CSSProperties } from 'react'
import { BoardColumn } from './BoardColumn'
import { CardView } from './BoardCard'
import { findColumnOf } from './boardLogic'
import { boardMachine } from './boardMachine'
import { CardForm } from './CardForm'
import { Confetti } from './Confetti'
import { Modal } from './Modal'
import { dangerButton, secondaryButton } from './styles'
import { DEFAULT_COLUMNS, type BoardData, type ColumnDef, type Point, type SearchCharacters } from './types'

export interface KanbanBoardProps {
  /** Data source for the character picker; the board is agnostic to the API behind it. */
  searchCharacters: SearchCharacters
  /** Read once on mount, like `defaultValue`. */
  columns?: ColumnDef[]
  /** Read once on mount, like `defaultValue`. */
  initialBoard?: BoardData
  /** Receives the full board after each committed change (not on every drag frame). */
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
  const formHeadingId = useId()

  const isIdle = snapshot.matches({ interaction: 'idle' })
  const isDragging = snapshot.matches({ interaction: 'dragging' })
  // Modals lock dragging; a drag in progress only locks the card actions.
  const dragLocked = !isIdle && !isDragging

  // Mid-drag previews aren't emitted, and a cancelled drag restores the original reference,
  // so only committed changes reach onChange.
  const emitChange = useEffectEvent((next: BoardData) => onChange?.(next))
  useEffect(() => {
    let last = actorRef.getSnapshot().context.board
    const subscription = actorRef.subscribe((next) => {
      if (next.matches({ interaction: 'dragging' }) || next.context.board === last) return
      last = next.context.board
      emitChange(last)
    })
    return () => subscription.unsubscribe()
  }, [actorRef])

  // Mouse: a small distance threshold keeps button clicks working.
  // Touch: a long press, so swiping still scrolls the page.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
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
  const celebratedCard = celebration ? board.cards[celebration.cardId] : null
  const cardCount = Object.keys(board.cards).length

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <section
        aria-labelledby={formHeadingId}
        className="rounded-2xl bg-white/3 p-5 ring-1 ring-white/10 lg:tall:sticky lg:tall:top-6"
      >
        <h2 id={formHeadingId} className="mb-4 text-lg font-semibold">
          New card
        </h2>
        <CardForm
          submitLabel={`Add to ${columnDefs[0]?.title ?? 'board'}`}
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
            className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(var(--column-count),minmax(0,1fr))]"
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
          />
        </Modal>
      )}

      {deletingCard && (
        <Modal title="Delete card?" onClose={() => send({ type: 'CANCEL' })}>
          <p className="mb-6 text-slate-300">
            “{deletingCard.title}” will be sent to a dimension it can’t come back from.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => send({ type: 'CANCEL' })} className={secondaryButton}>
              Cancel
            </button>
            <button type="button" onClick={() => send({ type: 'CONFIRM' })} className={dangerButton}>
              Delete
            </button>
          </div>
        </Modal>
      )}

      {celebration && (
        <Confetti
          key={celebration.key}
          origin={celebration.origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 }}
        />
      )}
      <p className="sr-only" aria-live="polite">
        {celebratedCard ? `${celebratedCard.title} is done. Wubba lubba dub dub!` : ''}
      </p>
    </div>
  )
}
