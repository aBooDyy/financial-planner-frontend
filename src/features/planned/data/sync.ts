import { db } from '#/db/db'
import { pullDelta } from '#/db/delta'
import { flagEntry, invalidItemFailure } from '#/db/syncFailure'
import type { LocalPlanned, OutboxEntry } from '#/db/types'
import { plannedApi } from '#/features/planned/api/plannedApi'
import type {
  CreatePlannedWire,
  Planned,
  UpdatePlannedWire,
} from '#/features/planned/api/types'
import { ApiError } from '#/lib/apiError'
import { localPlannedToUpdateWire, serverPlannedToLocal } from './mappers'

/**
 * Push/pull handlers for planned rows, plugged into the shared engine (`db/sync.ts`). They
 * follow the other entities (409 rebases once, 404 drops, a network error bubbles up) with
 * one branch of their own: a create refused because the id is taken is the ordinary outcome
 * of two devices generating the same occurrence, not a failure.
 */

const HAS_SETTLEMENTS = 'planned.has_settlements'

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)
const codeOf = (e: unknown): string | null =>
  e instanceof ApiError ? e.code : null

const othersPending = async (entry: OutboxEntry): Promise<boolean> =>
  (await db.outbox.where('[entity+id]').equals(['planned', entry.id]).count()) >
  1

/**
 * What the user did to a row before its create landed. A freshly generated row is open,
 * unpinned and unannotated, so any of these is intent the server copy does not have yet.
 */
const carriesIntent = (row: LocalPlanned): boolean =>
  row.status !== 'open' || row.pinned || row.note !== null

/**
 * The id was already taken: another device generated the same occurrence. Nothing of ours
 * is lost by adopting the server's row — unless the user acted on this copy before its
 * create went out, in which case that action is re-applied on top (last write wins).
 */
async function settleTakenId(
  entry: OutboxEntry,
  server: Planned | null,
): Promise<void> {
  const local = await db.plannedTransactions.get(entry.id)
  await db.outbox.delete(entry.seq)
  if (!server) {
    // Not ours to read (or gone again): nothing left to reconcile against.
    if (local && !(await othersPending(entry)))
      await db.plannedTransactions.delete(entry.id)
    return
  }
  if (local && carriesIntent(local)) {
    try {
      const merged = await plannedApi.update(
        entry.id,
        localPlannedToUpdateWire({ ...local, version: server.version }),
      )
      await db.plannedTransactions.put(serverPlannedToLocal(merged))
      return
    } catch (e) {
      if (statusOf(e) === 0) throw e
    }
  }
  await db.plannedTransactions.put(serverPlannedToLocal(server))
}

const findOnServer = async (id: string): Promise<Planned | null> =>
  (await plannedApi.list()).find((p) => p.id === id) ?? null

async function pushPlannedCreate(entry: OutboxEntry): Promise<void> {
  try {
    const row = await plannedApi.create(entry.payload as CreatePlannedWire)
    await db.transaction('rw', db.plannedTransactions, db.outbox, async () => {
      await db.plannedTransactions.put(serverPlannedToLocal(row))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await settleTakenId(entry, await findOnServer(entry.id))
  }
}

/**
 * A run of queued creates as one request — the planner's first pass over an existing account
 * writes dozens. Answered per item, like the ledger's bulk: a created row is stored, a taken
 * id is settled as above, an invalid one is flagged, an unanswered one stays queued.
 */
export async function pushPlannedCreates(
  entries: ReadonlyArray<OutboxEntry>,
): Promise<void> {
  const results = await plannedApi.bulkCreate(
    entries.map((entry) => entry.payload as CreatePlannedWire),
  )
  const byId = new Map(results.map((r) => [r.id, r]))
  let listed: Planned[] | null = null
  for (const entry of entries) {
    const result = byId.get(entry.id)
    if (!result) continue
    if (result.status === 'created' && result.planned) {
      const row = result.planned
      await db.transaction(
        'rw',
        db.plannedTransactions,
        db.outbox,
        async () => {
          await db.plannedTransactions.put(serverPlannedToLocal(row))
          await db.outbox.delete(entry.seq)
        },
      )
    } else if (result.status === 'taken') {
      let server = result.planned
      if (!server) {
        listed ??= await plannedApi.list()
        server = listed.find((p) => p.id === entry.id) ?? null
      }
      await settleTakenId(entry, server)
    } else {
      await flagEntry(
        entry,
        invalidItemFailure(result.errorCode, result.errorField),
      )
    }
  }
}

async function pushPlannedUpdate(entry: OutboxEntry): Promise<void> {
  try {
    const row = await plannedApi.update(
      entry.id,
      entry.payload as UpdatePlannedWire,
    )
    await db.transaction('rw', db.plannedTransactions, db.outbox, async () => {
      await db.plannedTransactions.put(serverPlannedToLocal(row))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebasePlanned(entry)
    if (status === 404) {
      await db.transaction(
        'rw',
        db.plannedTransactions,
        db.outbox,
        async () => {
          await db.plannedTransactions.delete(entry.id)
          await db.outbox.delete(entry.seq)
        },
      )
      return
    }
    throw e
  }
}

async function rebasePlanned(entry: OutboxEntry): Promise<void> {
  const fresh = await findOnServer(entry.id)
  const local = await db.plannedTransactions.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const row = await plannedApi.update(
      entry.id,
      localPlannedToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction('rw', db.plannedTransactions, db.outbox, async () => {
      await db.plannedTransactions.put(serverPlannedToLocal(row))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await db.transaction('rw', db.plannedTransactions, db.outbox, async () => {
      await db.plannedTransactions.put(serverPlannedToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushPlannedDelete(entry: OutboxEntry): Promise<void> {
  try {
    await plannedApi.remove(entry.id)
  } catch (e) {
    if (codeOf(e) === HAS_SETTLEMENTS) {
      // Something settles it server-side, so it stays; the delta will not re-send an
      // unchanged row, so fetch it back rather than leave it missing here.
      const server = await findOnServer(entry.id)
      await db.transaction(
        'rw',
        db.plannedTransactions,
        db.outbox,
        async () => {
          if (server)
            await db.plannedTransactions.put(serverPlannedToLocal(server))
          await db.outbox.delete(entry.seq)
        },
      )
      return
    }
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.plannedTransactions, db.outbox, async () => {
    await db.plannedTransactions.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

/** Push one planned outbox entry. Throws on network / unexpected errors. */
export async function pushPlannedEntry(entry: OutboxEntry): Promise<void> {
  if (entry.op === 'create') return pushPlannedCreate(entry)
  if (entry.op === 'update') return pushPlannedUpdate(entry)
  return pushPlannedDelete(entry)
}

// --- Pull ----------------------------------------------------------------------------

async function upsertFromServer(p: Planned): Promise<void> {
  const local = await db.plannedTransactions.get(p.id)
  if (!local || (local.dirty === 0 && local.deleted === 0)) {
    await db.plannedTransactions.put(serverPlannedToLocal(p))
  }
}

/** A row holding an unpushed edit stays: its own push settles it. */
async function dropLocally(id: string): Promise<void> {
  const local = await db.plannedTransactions.get(id)
  if (local && local.dirty === 0) await db.plannedTransactions.delete(id)
}

export async function pullPlanned(): Promise<void> {
  const server = await plannedApi.list()
  const ids = new Set(server.map((p) => p.id))
  await db.transaction('rw', db.plannedTransactions, async () => {
    for (const p of server) await upsertFromServer(p)
    for (const l of await db.plannedTransactions.toArray()) {
      if (!ids.has(l.id)) await dropLocally(l.id)
    }
  })
}

/** Planned rows accumulate (history is kept), so they pull as a delta like the ledger. */
export const pullPlannedDelta = (): Promise<void> =>
  pullDelta<Planned>({
    entity: 'planned',
    fetchChanges: plannedApi.changes,
    apply: async (items, deletedIds) => {
      await db.transaction('rw', db.plannedTransactions, async () => {
        for (const p of items) await upsertFromServer(p)
        for (const id of deletedIds) await dropLocally(id)
      })
    },
    idOf: (p) => p.id,
    fullPull: pullPlanned,
    reconcile: async (delivered) => {
      await db.transaction('rw', db.plannedTransactions, async () => {
        for (const l of await db.plannedTransactions.toArray()) {
          if (!delivered.has(l.id)) await dropLocally(l.id)
        }
      })
    },
  })
