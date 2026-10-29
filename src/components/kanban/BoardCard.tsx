import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KeyboardEventHandler, PointerEventHandler, ReactNode } from 'react'
import { CheckIcon, GripIcon, PencilIcon, TrashIcon } from './icons'
import type { Card } from './types'

interface CardViewProps {
  card: Card
  done?: boolean
  celebrating?: boolean
  /** Rendered as the floating copy under the pointer while dragging. */
  overlay?: boolean
  handle?: ReactNode
  actions?: ReactNode
}

/** Purely presentational, so it can be shared by the sortable card and the drag overlay. */
export function CardView({ card, done, celebrating, overlay, handle, actions }: CardViewProps) {
  return (
    <article
      className={`group relative rounded-xl bg-slate-800/80 p-3 ring-1 transition ${
        overlay ? 'rotate-2 shadow-2xl ring-portal/60' : 'shadow-sm ring-white/10 hover:ring-white/20'
      } ${celebrating ? 'portal-glow' : ''}`}
    >
      <div className="flex items-start gap-2">
        {handle ?? (
          <span className="mt-1 text-slate-500">
            <GripIcon />
          </span>
        )}
        <img
          src={card.character.image}
          alt=""
          className="size-10 shrink-0 rounded-full object-cover ring-2 ring-white/10"
        />
        <div className={`min-w-0 flex-1 ${actions ? 'pointer-coarse:pr-16' : ''}`}>
          <h3 className={`flex items-center gap-1.5 font-semibold break-words ${done ? 'text-slate-300' : ''}`}>
            {done && (
              <span className="text-portal">
                <CheckIcon />
                <span className="sr-only">Done:</span>
              </span>
            )}
            {card.title}
          </h3>
          <p className="truncate text-xs text-slate-400">
            {card.character.name}
            {card.character.species && ` · ${card.character.species}`}
          </p>
        </div>
        {actions}
      </div>
      {card.description && (
        <p className="mt-2 line-clamp-3 pl-6 text-sm whitespace-pre-line text-slate-300">{card.description}</p>
      )}
    </article>
  )
}

interface SortableCardProps {
  card: Card
  done: boolean
  celebrating: boolean
  dragDisabled: boolean
  actionsDisabled: boolean
  onEdit: () => void
  onDelete: () => void
}

export function SortableCard({
  card,
  done,
  celebrating,
  dragDisabled,
  actionsDisabled,
  onEdit,
  onDelete,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: dragDisabled })
  // dnd-kit types listeners loosely (Record<string, Function>); these are the two activators it registers.
  const onPointerDown = listeners?.onPointerDown as PointerEventHandler | undefined
  const onKeyDown = listeners?.onKeyDown as KeyboardEventHandler | undefined

  return (
    <li
      ref={setNodeRef}
      data-card-id={card.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Pointer drags work from anywhere on the card (the sensor's distance threshold keeps
      // button clicks working); keyboard drags start from the dedicated handle, so pressing
      // Enter on Edit/Delete never picks the card up.
      onPointerDown={onPointerDown}
      className={`touch-manipulation select-none ${isDragging ? 'opacity-30' : ''} ${
        dragDisabled ? '' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      <CardView
        card={card}
        done={done}
        celebrating={celebrating}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            onKeyDown={onKeyDown}
            aria-label={`Move “${card.title}”`}
            className="mt-1 rounded text-slate-500 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-portal"
          >
            <GripIcon />
          </button>
        }
        actions={
          // Floats over the card so it doesn't steal title width; revealed on hover/focus
          // for mouse users and always visible on touch.
          <div className="absolute top-2 right-2 flex gap-0.5 rounded-lg bg-slate-800 shadow-sm transition pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100">
            <IconButton label={`Edit “${card.title}”`} onClick={onEdit} disabled={actionsDisabled}>
              <PencilIcon />
            </IconButton>
            <IconButton label={`Delete “${card.title}”`} onClick={onDelete} disabled={actionsDisabled}>
              <TrashIcon />
            </IconButton>
          </div>
        }
      />
    </li>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-portal disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
