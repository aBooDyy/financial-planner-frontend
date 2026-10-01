/**
 * Pushing an action on one versioned row — close, reopen, pause, resume — rather than a PATCH
 * of it. The queued payload carries no version: the row's last-synced one is read when the
 * action goes out, so an edit pushed just before it never leaves it stale.
 *
 * The answers mirror the server's checks, in its order:
 * - a `doneCodes` refusal (already closed, not paused…) means the row is already in the asked
 *   state — another device, or a replay of this one — so the entry is settled and the server's
 *   copy adopted;
 * - `404` — the row is gone server-side;
 * - `409 common.conflict` — the version moved: retry once on the fresh one, and on a second
 *   conflict take the server's copy rather than loop;
 * - anything else is thrown for the engine to flag.
 */
import { ApiError } from '#/lib/apiError'
import { db } from './db'
import type { OutboxEntry } from './types'

export type ItemAction<TResult> = {
  /** The row's last-synced version; undefined when the row is no longer held. */
  localVersion: () => Promise<string | undefined>
  /** The server's current version; undefined when the server no longer has the row. */
  freshVersion: () => Promise<string | undefined>
  send: (version: string) => Promise<TResult>
  /** Store what the server answered. */
  store: (result: TResult) => Promise<void>
  /** Take the server's word for the row and what the action touches. */
  adopt: () => Promise<void>
  /** The row is gone server-side. */
  gone: () => Promise<void>
  doneCodes: ReadonlyArray<string>
}

const codeOf = (e: unknown): string | null =>
  e instanceof ApiError ? e.code : null
const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

export async function pushItemAction<TResult>(
  entry: OutboxEntry,
  action: ItemAction<TResult>,
): Promise<void> {
  const settle = () => db.outbox.delete(entry.seq)
  const finish = async (result: TResult) => {
    await action.store(result)
    await settle()
  }
  const version = await action.localVersion()
  if (version === undefined) {
    await settle()
    return
  }
  try {
    await finish(await action.send(version))
  } catch (e) {
    const code = codeOf(e)
    if (code !== null && action.doneCodes.includes(code)) {
      await settle()
      await action.adopt()
      return
    }
    if (statusOf(e) === 404) {
      await action.gone()
      await settle()
      return
    }
    if (code !== 'common.conflict') throw e
    const fresh = await action.freshVersion()
    if (fresh === undefined) {
      await action.gone()
      await settle()
      return
    }
    try {
      await finish(await action.send(fresh))
    } catch (again) {
      if (statusOf(again) !== 409) throw again
      await settle()
      await action.adopt()
    }
  }
}
