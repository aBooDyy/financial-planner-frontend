import { db } from '#/db/db'
import { queuedBesides } from '#/db/enqueue'
import { pushItemAction } from '#/db/itemAction'
import { storeAnswer } from '#/db/storeAnswer'
import type { OutboxEntry } from '#/db/types'
import { billsApi } from '#/features/bills/api/billsApi'
import type { CreateBillWire, UpdateBillWire } from '#/features/bills/api/types'
import type { CloseWire } from '#/features/setAsides/api/types'
import {
  resyncSetAsides,
  storeServerSetAsides,
} from '#/features/setAsides/data/sync'
import { ApiError } from '#/lib/apiError'
import { localBillToUpdateWire, serverBillToLocal } from './mappers'

/**
 * Push/pull handlers for bills, plugged into the shared sync engine (`db/sync.ts`). The usual
 * contract: the last-synced `version` is the optimistic base, a `409` rebases and retries
 * once, a `404` drops the local row, anything else bubbles up to be flagged.
 */

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

async function storeBill(
  entry: OutboxEntry,
  bill: Parameters<typeof serverBillToLocal>[0],
): Promise<void> {
  await db.transaction('rw', db.bills, db.outbox, async () => {
    await storeAnswer(
      db.bills,
      serverBillToLocal(bill),
      await queuedBesides(entry),
    )
    await db.outbox.delete(entry.seq)
  })
}

async function pushBillCreate(entry: OutboxEntry): Promise<void> {
  try {
    await storeBill(
      entry,
      await billsApi.create(entry.payload as CreateBillWire),
    )
  } catch (e) {
    if (statusOf(e) === 409) {
      // The id is already the server's: a retried create that landed before.
      await db.outbox.delete(entry.seq)
      await pullBills()
      return
    }
    throw e
  }
}

async function pushBillUpdate(entry: OutboxEntry): Promise<void> {
  try {
    await storeBill(
      entry,
      await billsApi.update(entry.id, entry.payload as UpdateBillWire),
    )
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseBill(entry)
    if (status === 404) {
      await db.transaction('rw', db.bills, db.outbox, async () => {
        await db.bills.delete(entry.id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

/** Last-write-wins, client re-apply: the local row on the server's version, once. */
async function rebaseBill(entry: OutboxEntry): Promise<void> {
  const fresh = (await billsApi.list()).find((b) => b.id === entry.id)
  const local = await db.bills.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    await storeBill(
      entry,
      await billsApi.update(
        entry.id,
        localBillToUpdateWire({ ...local, version: fresh.version }),
      ),
    )
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await storeBill(entry, fresh)
  }
}

async function pushBillDelete(entry: OutboxEntry): Promise<void> {
  try {
    await billsApi.del(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.bills, db.outbox, async () => {
    await db.bills.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

// --- Actions -------------------------------------------------------------------------

const serverVersionOf = async (id: string): Promise<string | undefined> =>
  (await billsApi.list()).find((b) => b.id === id)?.version

/** Take the server's copy of the bill, or drop it when the server no longer has it. */
async function adoptServerBill(entry: OutboxEntry): Promise<void> {
  const fresh = (await billsApi.list()).find((b) => b.id === entry.id)
  if (fresh)
    await storeAnswer(
      db.bills,
      serverBillToLocal(fresh),
      await queuedBesides(entry),
    )
  else await db.bills.delete(entry.id)
}

async function pushBillClose(entry: OutboxEntry): Promise<void> {
  const payload = entry.payload as CloseWire
  await pushItemAction(entry, {
    localVersion: async () => (await db.bills.get(entry.id))?.version,
    freshVersion: () => serverVersionOf(entry.id),
    send: (version) => billsApi.close(entry.id, { ...payload, version }),
    store: async ({ bill, released, created }) => {
      await storeAnswer(
        db.bills,
        serverBillToLocal(bill),
        await queuedBesides(entry),
      )
      await storeServerSetAsides([...released, ...created])
    },
    adopt: async () => {
      const own = await db.setAsides
        .where('billId')
        .equals(entry.id)
        .primaryKeys()
      await adoptServerBill(entry)
      await resyncSetAsides([
        ...own,
        ...Object.values(payload.move_to?.new_ids ?? {}),
      ])
    },
    gone: () => db.bills.delete(entry.id),
    doneCodes: ['planning.bill.already_closed'],
  })
}

async function pushBillReopen(entry: OutboxEntry): Promise<void> {
  await pushItemAction(entry, {
    localVersion: async () => (await db.bills.get(entry.id))?.version,
    freshVersion: () => serverVersionOf(entry.id),
    send: (version) => billsApi.reopen(entry.id, { version }),
    store: async (bill) => {
      await storeAnswer(
        db.bills,
        serverBillToLocal(bill),
        await queuedBesides(entry),
      )
    },
    adopt: () => adoptServerBill(entry),
    gone: () => db.bills.delete(entry.id),
    doneCodes: ['planning.bill.not_closed'],
  })
}

/** Push one `bill` outbox entry. Throws on network/unexpected errors. */
export async function pushBillsEntry(entry: OutboxEntry): Promise<void> {
  if (entry.op === 'create') return pushBillCreate(entry)
  if (entry.op === 'update') return pushBillUpdate(entry)
  if (entry.op === 'close') return pushBillClose(entry)
  if (entry.op === 'reopen') return pushBillReopen(entry)
  return pushBillDelete(entry)
}

/** Bills are read in full: a bounded list, and absence from it is how a delete arrives. */
export async function pullBills(): Promise<void> {
  const server = await billsApi.list()
  const ids = new Set(server.map((b) => b.id))
  await db.transaction('rw', db.bills, async () => {
    for (const b of server) {
      const local = await db.bills.get(b.id)
      // Local edits win until they have been pushed.
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.bills.put(serverBillToLocal(b))
      }
    }
    for (const l of await db.bills.toArray()) {
      if (l.dirty === 0 && !ids.has(l.id)) await db.bills.delete(l.id)
    }
  })
}
