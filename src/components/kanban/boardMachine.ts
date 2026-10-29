import { assign, raise, setup } from 'xstate'
import {
  addCard,
  createId,
  findColumnOf,
  isCompleteDraft,
  moveCard,
  normalizeBoard,
  removeCard,
  updateCard,
} from './boardLogic'
import type { BoardData, CardId, ColumnDef, ColumnId, CompleteDraft, Point } from './types'

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
 */
export const boardMachine = setup({
  types: {
    context: {} as BoardContext,
    events: {} as BoardEvent,
    input: {} as BoardInput,
  },
  delays: {
    celebrationDuration: CELEBRATION_MS,
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
              guard: ({ event, context }) => isCompleteDraft(event.draft) && context.columns.length > 0,
              actions: assign({
                board: ({ context, event }) =>
                  addCard(
                    context.board,
                    {
                      id: createId(),
                      title: event.draft.title.trim(),
                      description: event.draft.description.trim(),
                      character: event.draft.character,
                      createdAt: Date.now(),
                    },
                    context.columns[0].id,
                  ),
              }),
            },
            DRAG_START: {
              guard: ({ context, event }) => event.cardId in context.board.cards,
              target: 'dragging',
              actions: assign({
                activeId: ({ event }) => event.cardId,
                boardBeforeDrag: ({ context }) => context.board,
              }),
            },
            EDIT: {
              guard: ({ context, event }) => event.cardId in context.board.cards,
              target: 'editing',
              actions: assign({ editingId: ({ event }) => event.cardId }),
            },
            DELETE: {
              guard: ({ context, event }) => event.cardId in context.board.cards,
              target: 'confirmingDelete',
              actions: assign({ deletingId: ({ event }) => event.cardId }),
            },
          },
        },

        dragging: {
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
          on: {
            SAVE: {
              guard: ({ event }) => isCompleteDraft(event.draft),
              target: 'idle',
              actions: [
                assign({
                  board: ({ context, event }) =>
                    updateCard(context.board, context.editingId!, {
                      title: event.draft.title.trim(),
                      description: event.draft.description.trim(),
                      character: event.draft.character,
                    }),
                }),
                'clearEditing',
              ],
            },
            CANCEL: { target: 'idle', actions: 'clearEditing' },
          },
        },

        confirmingDelete: {
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
        // Raised on every drop; only a card *arriving* in a celebrate column counts.
        CELEBRATE: {
          guard: ({ context, event }) =>
            isCelebrateColumn(context.columns, findColumnOf(context.board, event.cardId)) &&
            !isCelebrateColumn(context.columns, event.fromColumnId),
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
