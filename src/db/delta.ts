import { ApiError } from '#/lib/apiError'
import type { ChangesPage, ChangesQuery } from './changes'
import type { DeltaEntityName } from './watermarks'
import { clearWatermark, readWatermark, writeWatermark } from './watermarks'

/**
 * Rows per page — the server's own maximum. The same value goes out on every page of one
 * run, because the cursor was cut for it.
 */
const PAGE_LIMIT = 1000

const SINCE_INVALID = 'sync.since_invalid'

export type DeltaSpec<T> = {
  entity: DeltaEntityName
  fetchChanges: (query: ChangesQuery) => Promise<ChangesPage<T>>
  /**
   * Upsert `items` and apply `deletedIds`. Must be idempotent by id: the server reads from
   * just before the watermark, so every delta re-delivers the rows written in the second
   * around it.
   */
  apply: (
    items: ReadonlyArray<T>,
    deletedIds: ReadonlyArray<string>,
  ) => Promise<void>
  idOf: (item: T) => string
  /** The full-list pull, with its "delete what the server did not return" reconciliation. */
  fullPull: () => Promise<void>
  /**
   * Drop local rows a first sync did not deliver. A delta with no `since` carries every
   * live row, so absence means gone — the one thing a watermark-less client cannot learn
   * from the tombstones, which only cover the window it never had.
   */
  reconcile?: (deliveredIds: ReadonlySet<string>) => Promise<void>
}

/**
 * Pull one entity incrementally: page until the server says the window is complete, then
 * — and only then — adopt its clock as the next `since`.
 */
export async function pullDelta<T>(spec: DeltaSpec<T>): Promise<void> {
  try {
    await runDelta(spec)
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== SINCE_INVALID)
      throw error
    // The stored watermark is unusable, and resending it would wedge this entity forever.
    await clearWatermark(spec.entity)
    await runDelta(spec)
  }
}

async function runDelta<T>(spec: DeltaSpec<T>): Promise<void> {
  const since = await readWatermark(spec.entity)
  const delivered = since === null ? new Set<string>() : null
  let query: ChangesQuery = { since, limit: PAGE_LIMIT }

  for (;;) {
    const page = await spec.fetchChanges(query)

    if (page.fullResyncRequired) {
      // Our window predates the tombstone retention, so the server cannot vouch for what
      // was deleted inside it. Only the full list can, and it is a snapshot no older than
      // `as_of`, which therefore stays a safe watermark to resume from.
      await spec.fullPull()
      await writeWatermark(spec.entity, page.asOf)
      return
    }

    await spec.apply(page.items, page.deletedIds)
    if (delivered) for (const item of page.items) delivered.add(spec.idOf(item))

    if (page.complete) {
      if (delivered) await spec.reconcile?.(delivered)
      await writeWatermark(spec.entity, page.asOf)
      return
    }
    // A run that stops short leaves the old watermark in place: it restarts from there and
    // re-applies what it already had, which an upsert by id makes free.
    if (!page.cursor) return
    query = { cursor: page.cursor, limit: PAGE_LIMIT }
  }
}
