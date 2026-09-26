import { db } from './db'
import { flushOutbox } from './sync'
import { releaseRow } from './syncFailure'
import type { OutboxEntity } from './types'

/** Retry one row's queued changes now, ignoring their backoff. */
export async function retrySync(
  entity: OutboxEntity,
  id: string,
): Promise<void> {
  await releaseRow(entity, id)
  await flushOutbox()
}

/** Retry every flagged change now, ignoring backoff. */
export async function retryAllFailed(): Promise<void> {
  await db.outbox
    .filter((entry) => entry.failure !== undefined)
    .modify((entry) => {
      entry.nextAttemptAt = null
    })
  await flushOutbox()
}
