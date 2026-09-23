/**
 * The `…/changes` transport contract, shared by every entity that syncs incrementally.
 * One shape, because a delta read asks the same questions of each of them.
 */

export type ChangesQuery =
  | { since: string | null; limit: number }
  | { cursor: string; limit: number }

export type ChangesWire<T> = {
  as_of: string
  items: T[]
  deleted_ids: string[]
  complete: boolean
  cursor: string | null
  full_resync_required: boolean
  retention_days: number
}

export type ChangesPage<T> = {
  /** The server's clock, and the only value that may become the next `since`. */
  asOf: string
  items: T[]
  deletedIds: string[]
  complete: boolean
  cursor: string | null
  fullResyncRequired: boolean
}

/**
 * A cursor carries its own window, so `since` is never sent beside it — the server would
 * ignore ours, leaving us reasoning about a window we did not choose.
 */
export const changesPath = (base: string, query: ChangesQuery): string => {
  const params = new URLSearchParams({ limit: String(query.limit) })
  if ('cursor' in query) params.set('cursor', query.cursor)
  else if (query.since) params.set('since', query.since)
  return `${base}/changes?${params.toString()}`
}

export const toChangesPage = <TWire, T>(
  wire: ChangesWire<TWire>,
  toItem: (item: TWire) => T,
): ChangesPage<T> => ({
  asOf: wire.as_of,
  items: wire.items.map(toItem),
  deletedIds: wire.deleted_ids,
  complete: wire.complete,
  cursor: wire.cursor,
  fullResyncRequired: wire.full_resync_required,
})
