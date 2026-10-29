import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableCard } from './BoardCard'
import type { Card, CardId, ColumnDef } from './types'

interface BoardColumnProps {
  column: ColumnDef
  cards: Card[]
  isDropTarget: boolean
  celebratingCardId: CardId | null
  dragDisabled: boolean
  actionsDisabled: boolean
  onEdit: (cardId: CardId) => void
  onDelete: (cardId: CardId) => void
}

export function BoardColumn({
  column,
  cards,
  isDropTarget,
  celebratingCardId,
  dragDisabled,
  actionsDisabled,
  onEdit,
  onDelete,
}: BoardColumnProps) {
  // The column itself is droppable so empty columns can receive cards.
  const { setNodeRef } = useDroppable({ id: column.id })
  const headingId = `column-${column.id}`

  return (
    <section
      aria-labelledby={headingId}
      className={`flex flex-col rounded-2xl bg-white/[0.03] p-3 ring-1 transition ${
        isDropTarget ? 'ring-portal/50 bg-portal/[0.04]' : 'ring-white/10'
      }`}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2
          id={headingId}
          className={`text-sm font-semibold tracking-wider uppercase ${column.celebrate ? 'text-portal' : 'text-slate-300'}`}
        >
          {column.title}
        </h2>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300" aria-label={`${cards.length} cards`}>
          {cards.length}
        </span>
      </header>

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-40 flex-1 flex-col gap-2">
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              done={!!column.celebrate}
              celebrating={card.id === celebratingCardId}
              dragDisabled={dragDisabled}
              actionsDisabled={actionsDisabled}
              onEdit={() => onEdit(card.id)}
              onDelete={() => onDelete(card.id)}
            />
          ))}
          {cards.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
              {column.celebrate ? 'Drop finished cards here 🎉' : 'Drop cards here'}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  )
}
