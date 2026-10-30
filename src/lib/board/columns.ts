import type { ColumnDef } from '../../types'

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done', celebrate: true },
]
