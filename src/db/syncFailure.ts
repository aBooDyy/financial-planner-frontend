import { ApiError } from '#/lib/apiError'
import { db } from './db'
import type { OutboxEntity, OutboxEntry, SyncFailure } from './types'

const MINUTE_MS = 60_000
/** Waits after the 1st, 2nd, 3rd and every later rejection. */
const BACKOFF_MINUTES = [1, 5, 15, 60] as const

/** Statuses that say nothing about the payload: the same request may succeed later. */
export const isUnavailableStatus = (status: number): boolean =>
  status === 0 || status === 408 || status === 429 || status >= 500

/**
 * What a failed push means for the entry it was pushing. `null` for a 401 that survived the
 * refresh: the session is ending, which is no verdict on the entry.
 */
export function failureOf(
  error: unknown,
  at: string = new Date().toISOString(),
): SyncFailure | null {
  if (!(error instanceof ApiError)) {
    return {
      kind: 'rejected',
      status: -1,
      code: 'common.unexpected',
      field: null,
      message: error instanceof Error ? error.message : String(error),
      at,
    }
  }
  if (error.isUnauthenticated) return null
  return {
    kind: isUnavailableStatus(error.status) ? 'unavailable' : 'rejected',
    status: error.status,
    code: error.code,
    field: error.details[0]?.field ?? null,
    message: error.message,
    at,
  }
}

/** A bulk endpoint's per-item `INVALID`: a rejection that carries no message of its own. */
export const invalidItemFailure = (
  code: string | null,
  field: string | null,
  at: string = new Date().toISOString(),
): SyncFailure => ({
  kind: 'rejected',
  status: 422,
  code: code ?? 'common.validation',
  field,
  message: '',
  at,
})

export const backoffMs = (attempts: number): number =>
  BACKOFF_MINUTES[Math.min(Math.max(attempts, 1), BACKOFF_MINUTES.length) - 1] *
  MINUTE_MS

export const rowKey = (entity: OutboxEntity, id: string): string =>
  `${entity}:${id}`

/** A rejected entry still inside its backoff window. */
export const isBackingOff = (entry: OutboxEntry, now: number): boolean =>
  entry.failure?.kind === 'rejected' &&
  !!entry.nextAttemptAt &&
  Date.parse(entry.nextAttemptAt) > now

const samePayload = (a: OutboxEntry, b: OutboxEntry): boolean =>
  JSON.stringify(a.payload) === JSON.stringify(b.payload)

/**
 * Record a failed push on the entry. Skipped when the entry was settled or re-queued with a
 * new payload while the request was out: the verdict was about a payload it no longer holds.
 */
export async function flagEntry(
  entry: OutboxEntry,
  failure: SyncFailure,
): Promise<void> {
  if (entry.seq === undefined) return
  const seq = entry.seq
  await db.transaction('rw', db.outbox, async () => {
    const current = await db.outbox.get(seq)
    if (!current || !samePayload(current, entry)) return
    if (failure.kind === 'unavailable') {
      await db.outbox.put({ ...current, failure, nextAttemptAt: null })
      return
    }
    const attempts = (current.attempts ?? 0) + 1
    await db.outbox.put({
      ...current,
      failure,
      attempts,
      nextAttemptAt: new Date(
        Date.parse(failure.at) + backoffMs(attempts),
      ).toISOString(),
    })
  })
}

/** The entry with a new payload queued in it: a verdict on the old one no longer applies. */
export function requeued(entry: OutboxEntry): OutboxEntry {
  const { failure: _failure, nextAttemptAt: _next, ...rest } = entry
  return rest
}

/** Lift the backoff of every rejected entry; returns how many were waiting. */
export async function releaseRejected(): Promise<number> {
  return db.outbox
    .filter((e) => e.failure?.kind === 'rejected' && !!e.nextAttemptAt)
    .modify((e) => {
      e.nextAttemptAt = null
    })
}

/** Lift the backoff of one row's entries, keeping their attempt count. */
export async function releaseRow(
  entity: OutboxEntity,
  id: string,
): Promise<void> {
  await db.outbox
    .where('[entity+id]')
    .equals([entity, id])
    .modify((e) => {
      e.nextAttemptAt = null
    })
}

/** The first failure of each row of these entities, keyed by row id. One read for a whole list. */
export async function failuresByRow(
  entities: ReadonlyArray<OutboxEntity>,
): Promise<Map<string, SyncFailure>> {
  const wanted = new Set<OutboxEntity>(entities)
  const failed = await db.outbox
    .filter((e) => e.failure !== undefined && wanted.has(e.entity))
    .toArray()
  const byRow = new Map<string, SyncFailure>()
  // `seq` order: the earliest failure is the one holding the row's later entries back.
  for (const entry of failed) {
    if (entry.failure && !byRow.has(entry.id))
      byRow.set(entry.id, entry.failure)
  }
  return byRow
}

/** The first failure among one row's queued entries, or null. */
export async function failureOfRow(
  entity: OutboxEntity,
  id: string,
): Promise<SyncFailure | null> {
  const entries = await db.outbox
    .where('[entity+id]')
    .equals([entity, id])
    .sortBy('seq')
  return entries.find((e) => e.failure)?.failure ?? null
}
