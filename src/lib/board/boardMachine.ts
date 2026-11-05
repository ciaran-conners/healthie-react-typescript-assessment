import { and, assign, raise, setup } from 'xstate'
import type { BoardData, CardId, ColumnDef, ColumnId, CompleteDraft, Point } from '../../types'
import {
  addCard,
  createId,
  findColumnOf,
  isCompleteDraft,
  moveCard,
  normalizeBoard,
  removeCard,
  toCardFields,
  updateCard,
} from './boardLogic'

export interface Celebration {
  cardId: CardId
  /** Viewport coordinates of the drop. */
  origin: Point | null
  /** Bumped on every celebration so back-to-back drops remount the animation. */
  key: number
}

export interface BoardContext {
  columns: ColumnDef[]
  board: BoardData
  activeId: CardId | null
  /** Snapshot taken at drag start, restored if the drag is cancelled. */
  boardBeforeDrag: BoardData | null
  editingId: CardId | null
  deletingId: CardId | null
  celebration: Celebration | null
}

export type BoardEvent =
  | { type: 'CREATE'; draft: CompleteDraft }
  | { type: 'DRAG_START'; cardId: CardId }
  | { type: 'DRAG_OVER'; overId: string }
  | { type: 'DRAG_END'; overId: string | null; origin: Point | null }
  | { type: 'DRAG_CANCEL' }
  | { type: 'EDIT'; cardId: CardId }
  | { type: 'SAVE'; draft: CompleteDraft }
  | { type: 'DELETE'; cardId: CardId }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'CELEBRATE'; cardId: CardId; fromColumnId: ColumnId | undefined; origin: Point | null }

export interface BoardInput {
  columns: ColumnDef[]
  board?: BoardData
}

export const CELEBRATION_MS = 1800

function isCelebrateColumn(columns: ColumnDef[], columnId: string | undefined) {
  return columns.some((column) => column.id === columnId && column.celebrate)
}

/**
 * `interaction` holds the mutually exclusive user modes; an event a mode doesn't handle is
 * ignored, which is how e.g. "can't drag while editing" is enforced. `celebration` runs in
 * parallel so the confetti never blocks the next interaction.
 *
 * Tags expose those rules to the UI so it can grey out controls without restating them:
 * - `cardActionsLocked`: creating, editing and deleting are unavailable (any non-idle mode).
 * - `dragLocked`: a modal is open, so cards can't be picked up.
 */
export const boardMachine = setup({
  types: {
    context: {} as BoardContext,
    events: {} as BoardEvent,
    input: {} as BoardInput,
    tags: {} as 'cardActionsLocked' | 'dragLocked',
  },
  delays: {
    celebrationDuration: CELEBRATION_MS,
  },
  guards: {
    draftIsComplete: ({ event }) => (event.type === 'CREATE' || event.type === 'SAVE') && isCompleteDraft(event.draft),
    hasColumns: ({ context }) => context.columns.length > 0,
    cardExists: ({ context, event }) => 'cardId' in event && event.cardId in context.board.cards,
    // Only a card *arriving* in a celebrate column counts, not one reordered within it.
    arrivedInCelebrateColumn: ({ context, event }) =>
      event.type === 'CELEBRATE' &&
      isCelebrateColumn(context.columns, findColumnOf(context.board, event.cardId)) &&
      !isCelebrateColumn(context.columns, event.fromColumnId),
  },
  // Cleanup runs as the last transition action rather than on `exit`, because exit actions
  // run *before* transition actions and would wipe the ids those transitions need.
  actions: {
    clearDrag: assign({ activeId: null, boardBeforeDrag: null }),
    clearEditing: assign({ editingId: null }),
    clearDeleting: assign({ deletingId: null }),
  },
}).createMachine({
  id: 'board',
  type: 'parallel',
  context: ({ input }) => ({
    columns: input.columns,
    board: normalizeBoard(input.columns, input.board),
    activeId: null,
    boardBeforeDrag: null,
    editingId: null,
    deletingId: null,
    celebration: null,
  }),
  states: {
    interaction: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            CREATE: {
              guard: and(['draftIsComplete', 'hasColumns']),
              actions: assign({
                board: ({ context, event }) =>
                  addCard(
                    context.board,
                    { id: createId(), ...toCardFields(event.draft), createdAt: Date.now() },
                    context.columns[0].id,
                  ),
              }),
            },
            DRAG_START: {
              guard: 'cardExists',
              target: 'dragging',
              actions: assign({
                activeId: ({ event }) => event.cardId,
                boardBeforeDrag: ({ context }) => context.board,
              }),
            },
            EDIT: {
              guard: 'cardExists',
              target: 'editing',
              actions: assign({ editingId: ({ event }) => event.cardId }),
            },
            DELETE: {
              guard: 'cardExists',
              target: 'confirmingDelete',
              actions: assign({ deletingId: ({ event }) => event.cardId }),
            },
          },
        },

        dragging: {
          tags: ['cardActionsLocked'],
          on: {
            // Only cross-column moves are applied live; dnd-kit animates in-column
            // reordering itself, and that is committed on drop.
            DRAG_OVER: {
              actions: assign({
                board: ({ context, event }) => {
                  const activeId = context.activeId!
                  const from = findColumnOf(context.board, activeId)
                  const to = findColumnOf(context.board, event.overId)
                  return from === to ? context.board : moveCard(context.board, activeId, event.overId)
                },
              }),
            },
            DRAG_END: {
              target: 'idle',
              actions: [
                assign({
                  board: ({ context, event }) =>
                    event.overId ? moveCard(context.board, context.activeId!, event.overId) : context.board,
                }),
                raise(({ context, event }) => ({
                  type: 'CELEBRATE' as const,
                  cardId: context.activeId!,
                  fromColumnId: findColumnOf(context.boardBeforeDrag ?? context.board, context.activeId!),
                  origin: event.origin,
                })),
                'clearDrag',
              ],
            },
            DRAG_CANCEL: {
              target: 'idle',
              actions: [
                assign({ board: ({ context }) => context.boardBeforeDrag ?? context.board }),
                'clearDrag',
              ],
            },
          },
        },

        editing: {
          tags: ['cardActionsLocked', 'dragLocked'],
          on: {
            SAVE: {
              guard: 'draftIsComplete',
              target: 'idle',
              actions: [
                assign({
                  board: ({ context, event }) =>
                    updateCard(context.board, context.editingId!, toCardFields(event.draft)),
                }),
                'clearEditing',
              ],
            },
            CANCEL: { target: 'idle', actions: 'clearEditing' },
          },
        },

        confirmingDelete: {
          tags: ['cardActionsLocked', 'dragLocked'],
          on: {
            CONFIRM: {
              target: 'idle',
              actions: [
                assign({ board: ({ context }) => removeCard(context.board, context.deletingId!) }),
                'clearDeleting',
              ],
            },
            CANCEL: { target: 'idle', actions: 'clearDeleting' },
          },
        },
      },
    },

    celebration: {
      initial: 'quiet',
      on: {
        // Raised on every drop; the guard filters it down to arrivals in Done.
        CELEBRATE: {
          guard: 'arrivedInCelebrateColumn',
          target: '.celebrating',
          reenter: true,
          actions: assign({
            celebration: ({ context, event }) => ({
              cardId: event.cardId,
              origin: event.origin,
              key: (context.celebration?.key ?? 0) + 1,
            }),
          }),
        },
      },
      states: {
        quiet: {},
        celebrating: {
          after: {
            celebrationDuration: {
              target: 'quiet',
              actions: assign({ celebration: null }),
            },
          },
        },
      },
    },
  },
})
