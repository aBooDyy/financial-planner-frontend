import { db } from '#/db/db'
import { pendingFor } from '#/db/enqueue'
import { storeAnswer } from '#/db/storeAnswer'
import { settleTakenCreate } from '#/db/takenCreate'
import type { LocalSetAside, OutboxEntry } from '#/db/types'
import { setAsidesApi } from '#/features/setAsides/api/setAsidesApi'
import type {
  CloseWire,
  CreateSetAsideWire,
  MoveItemWire,
  MoveWire,
  ReleaseItemWire,
  ReleaseWire,
  SetAside,
  UpdateSetAsideWire,
} from '#/features/setAsides/api/types'
import { ApiError } from '#/lib/apiError'
import { localSetAsideToUpdateWire, serverSetAsideToLocal } from './mappers'
import { hasQueuedWrites } from './queue'

/**
 * Push/pull handlers for set-asides, plugged into the shared sync engine (`db/sync.ts`): the
 * last-synced `version` is the optimistic base, a `409` rebases and retries once, a `404`
 * drops the local row, anything else bubbles up to be flagged.
 */

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

/**
 * Store rows an action answered with (a close, a release, a move) as the server now holds them —
 * except a row with writes still queued behind the action: it keeps the user's newer edit, and
 * its own push settles it.
 */
export async function storeServerSetAsides(
  rows: ReadonlyArray<SetAside>,
): Promise<void> {
  for (const row of rows) {
    await storeAnswer(
      db.setAsides,
      serverSetAsideToLocal(row),
      await hasQueuedWrites(row.id),
    )
  }
}

async function storeAndSettle(
  entry: OutboxEntry,
  row: SetAside,
): Promise<void> {
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    await db.outbox.delete(entry.seq)
    await storeAnswer(
      db.setAsides,
      serverSetAsideToLocal(row),
      await hasQueuedWrites(row.id),
    )
  })
}

async function pushSetAsideCreate(entry: OutboxEntry): Promise<void> {
  try {
    await storeAndSettle(
      entry,
      await setAsidesApi.create(entry.payload as CreateSetAsideWire),
    )
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await settleTakenCreate(entry, {
      table: db.setAsides,
      find: async () =>
        (await setAsidesApi.list()).find((a) => a.id === entry.id),
      toLocal: serverSetAsideToLocal,
      rebased: (local, server) =>
        localSetAsideToUpdateWire(onServer(local, server)),
      update: (body) =>
        setAsidesApi.update(entry.id, body as UpdateSetAsideWire),
      queued: () => hasQueuedWrites(entry.id),
    })
  }
}

async function pushSetAsideUpdate(entry: OutboxEntry): Promise<void> {
  try {
    await storeAndSettle(
      entry,
      await setAsidesApi.update(entry.id, entry.payload as UpdateSetAsideWire),
    )
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseSetAside(entry)
    if (status === 404) {
      await db.transaction('rw', db.setAsides, db.outbox, async () => {
        await db.setAsides.delete(entry.id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

/**
 * The local row on the server's version. Releasing is never an edit — it rides a batch or a
 * close — so the release fields are the server's: re-sending ours would un-release money another
 * device paid or freed, counting it as both spent and set aside.
 */
const onServer = (local: LocalSetAside, server: SetAside): LocalSetAside => ({
  ...local,
  version: server.version,
  releasedAt: server.releasedAt,
  releasedById: server.releasedById,
  movedByTransferId: server.movedByTransferId,
})

async function rebaseSetAside(entry: OutboxEntry): Promise<void> {
  const fresh = (await setAsidesApi.list()).find((a) => a.id === entry.id)
  const local = await db.setAsides.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    await storeAndSettle(
      entry,
      await setAsidesApi.update(
        entry.id,
        localSetAsideToUpdateWire(onServer(local, fresh)),
      ),
    )
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await storeAndSettle(entry, fresh)
  }
}

async function pushSetAsideDelete(entry: OutboxEntry): Promise<void> {
  try {
    await setAsidesApi.del(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    await db.setAsides.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

/**
 * Refusals that mean the batch can no longer apply as this device wrote it: a source already
 * released or gone, or an id already taken — on a replay, the batch itself landed before. The
 * batch is all-or-nothing server-side, so the server's rows are the answer.
 */
const BATCH_SETTLED = new Set([
  'planning.set_aside.already_released',
  'planning.set_aside.not_found',
  'planning.set_aside.id_taken',
])

/** Refusals naming sources that are no longer live there; the other items may still apply. */
const SOURCES_OVERTAKEN = new Set([
  'planning.set_aside.already_released',
  'planning.set_aside.not_found',
])

async function pushSetAsideBatch(entry: OutboxEntry): Promise<void> {
  try {
    const batch =
      entry.op === 'release'
        ? await setAsidesApi.release(entry.payload as ReleaseWire)
        : await setAsidesApi.move(entry.payload as MoveWire)
    await db.transaction('rw', db.setAsides, db.outbox, async () => {
      await db.outbox.delete(entry.seq)
      await storeServerSetAsides([...batch.released, ...batch.created])
    })
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    if (e.code === RELEASED_BY_INVALID) {
      const next = await withoutPayment(entry)
      if (!next) throw e
      return pushSetAsideBatch(next)
    }
    if (!BATCH_SETTLED.has(e.code)) throw e
    if (SOURCES_OVERTAKEN.has(e.code) && (await retryWithoutOvertaken(entry)))
      return
    await db.outbox.delete(entry.seq)
    await resyncSetAsides([entry.id, ...(entry.alsoRows ?? [])])
  }
}

const RELEASED_BY_INVALID = 'planning.set_aside.released_by_invalid'

/**
 * The payment a release names is not on the server. While its create is still queued it lands
 * first and the release goes through as written later (`null`: keep the refusal). Otherwise the
 * payment was deleted: the money is still released, just by no payment.
 */
async function withoutPayment(entry: OutboxEntry): Promise<OutboxEntry | null> {
  const { released_by_id: paymentId, ...payload } = entry.payload as ReleaseWire
  if (!paymentId || (await pendingFor('transaction', paymentId).count()) > 0)
    return null
  const next: OutboxEntry = { ...entry, payload }
  await db.outbox.put(next)
  return next
}

/** The rows one batch item writes: its source, and the remainder and new row it mints. */
const rowsOfItem = (item: ReleaseItemWire | MoveItemWire): string[] => [
  item.id,
  ...(item.remainder_id ? [item.remainder_id] : []),
  ...('new_id' in item ? [item.new_id] : []),
]

/**
 * Some sources stopped being live there while this batch waited — another device paid, freed or
 * deleted them. Those items settle on the server's rows; the rest of the user's batch is sent
 * again without them rather than dropped. `false` when there is nothing to keep — no source is
 * live there (a replay of this very batch, or all of them overtaken).
 */
async function retryWithoutOvertaken(entry: OutboxEntry): Promise<boolean> {
  const liveThere = new Set(
    (await setAsidesApi.list())
      .filter((a) => a.releasedAt === null)
      .map((a) => a.id),
  )
  const payload = entry.payload as ReleaseWire | MoveWire
  const items: (ReleaseItemWire | MoveItemWire)[] = payload.items
  const keep = items.filter((i) => liveThere.has(i.id))
  if (keep.length === 0 || keep.length === items.length) return false
  const dropped = new Set(
    items.filter((i) => !liveThere.has(i.id)).flatMap(rowsOfItem),
  )
  const rows = [entry.id, ...(entry.alsoRows ?? [])].filter(
    (id) => !dropped.has(id),
  )
  const next: OutboxEntry = {
    ...entry,
    id: rows[0],
    alsoRows: rows.slice(1),
    payload: { ...payload, items: keep },
  }
  await db.outbox.put(next)
  await resyncSetAsides([...dropped])
  await pushSetAsideBatch(next)
  return true
}

const MOVE_TARGET_INVALID = 'planning.close.move_target_invalid'

/**
 * A close whose leftover target the server refuses — closed, deleted, or never created there —
 * frees the leftover instead: the entry is rewritten to `FREE` and the copies minted for the
 * target are resynced away. While the target's own create is still queued it lands first and
 * the close goes through as asked later (`null`: keep the refusal). Bills and goals share it.
 */
export async function closeFreeingInstead(
  entry: OutboxEntry,
  error: unknown,
): Promise<OutboxEntry | null> {
  const payload = entry.payload as CloseWire
  const target = payload.move_to
  if (!(error instanceof ApiError) || error.code !== MOVE_TARGET_INVALID)
    return null
  if (!target) return null
  const targetRow = target.goal_id
    ? pendingFor('goal', target.goal_id)
    : pendingFor('bill', target.bill_id ?? '')
  if ((await targetRow.count()) > 0) return null
  const next: OutboxEntry = {
    ...entry,
    payload: { closed_at: payload.closed_at, leftover: 'FREE' },
  }
  await db.outbox.put(next)
  await resyncSetAsides(Object.values(target.new_ids ?? {}))
  return next
}

/** Give up a batch the server keeps refusing: its rows take the server's state. */
export async function abandonSetAsideBatch(entry: OutboxEntry): Promise<void> {
  await db.outbox.delete(entry.seq)
  await resyncSetAsides([entry.id, ...(entry.alsoRows ?? [])])
}

/** Push one `setAside` outbox entry. Throws on network/unexpected errors. */
export async function pushSetAsidesEntry(entry: OutboxEntry): Promise<void> {
  if (entry.op === 'create') return pushSetAsideCreate(entry)
  if (entry.op === 'update') return pushSetAsideUpdate(entry)
  if (entry.op === 'release' || entry.op === 'move')
    return pushSetAsideBatch(entry)
  return pushSetAsideDelete(entry)
}

/**
 * Set-asides are read in full, live and released alike, and absence is how a delete (or a
 * cascade from a deleted bill or goal) arrives. If the list ever grows too long for that, a
 * server-side delta stream is the follow-up.
 */
export async function pullSetAsides(): Promise<void> {
  const server = await setAsidesApi.list()
  const ids = new Set(server.map((a) => a.id))
  await db.transaction('rw', db.setAsides, async () => {
    for (const a of server) {
      const local = await db.setAsides.get(a.id)
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.setAsides.put(serverSetAsideToLocal(a))
      }
    }
    for (const l of await db.setAsides.toArray()) {
      if (l.dirty === 0 && !ids.has(l.id)) await db.setAsides.delete(l.id)
    }
  })
}

/**
 * An action this device applied locally (a close's or a batch's releases, remainders and new
 * rows) was settled by the server's own state instead — already applied, refused as stale, or
 * no longer applicable. The rows it marked hold no writes of their own, so they are cleaned and
 * the full pull replaces them with what the server holds (dropping rows it never wrote). A row
 * with writes still queued keeps them.
 */
export async function resyncSetAsides(
  ids: ReadonlyArray<string>,
): Promise<void> {
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    for (const id of ids) {
      if (!(await hasQueuedWrites(id)))
        await db.setAsides.update(id, { dirty: 0 })
    }
  })
  await pullSetAsides()
}
