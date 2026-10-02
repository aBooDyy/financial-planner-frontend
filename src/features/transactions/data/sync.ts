import { db } from '#/db/db'
import { pullDelta } from '#/db/delta'
import { queuedBesides } from '#/db/enqueue'
import { settleTakenCreate } from '#/db/takenCreate'
import { flagEntry, invalidItemFailure } from '#/db/syncFailure'
import type { OutboxEntry } from '#/db/types'
import {
  budgetsApi,
  transactionsApi,
} from '#/features/transactions/api/transactionsApi'
import type {
  CreateBudgetWire,
  CreateTransactionWire,
  Transaction,
  UpdateBudgetWire,
  UpdateTransactionWire,
} from '#/features/transactions/api/types'
import { ApiError } from '#/lib/apiError'
import {
  localBudgetToUpdateWire,
  localTransactionToUpdateWire,
  serverBudgetToLocal,
  serverTransactionToLocal,
} from './mappers'

/**
 * Push/pull handlers for the Spending entities, plugged into the shared sync engine
 * (`db/sync.ts`). They mirror the balances/goals handlers: 409 rebases-and-retries once,
 * 404 drops the local row, network errors bubble up so the engine retries later.
 */

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

// --- Transactions --------------------------------------------------------------------

async function pushTransactionCreate(entry: OutboxEntry): Promise<void> {
  try {
    const tx = await transactionsApi.create(
      entry.payload as CreateTransactionWire,
    )
    await db.transaction('rw', db.transactions, db.outbox, async () => {
      await db.transactions.put(serverTransactionToLocal(tx))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await settleTakenCreate(entry, {
      table: db.transactions,
      find: async () =>
        (await transactionsApi.list()).find((t) => t.id === entry.id),
      toLocal: serverTransactionToLocal,
      rebased: (local, server) =>
        localTransactionToUpdateWire({ ...local, version: server.version }),
      update: (body) =>
        transactionsApi.update(entry.id, body as UpdateTransactionWire),
      queued: () => queuedBesides(entry),
    })
  }
}

/**
 * Push a run of queued creates as one request. An import queues one entry per row, and a
 * queue drained a round trip at a time costs two orders of magnitude more than the local
 * commit it follows.
 *
 * The request is all-or-nothing; the *entries* are not. Each is answered on its own terms:
 * a written row is stored, an id the server already holds is settled from the row it sends
 * back, and an entry it judges unusable is flagged and stays queued — the same rule the
 * singular path applies to a rejection. An entry with no answer stays queued.
 */
export async function pushTransactionCreates(
  entries: ReadonlyArray<OutboxEntry>,
): Promise<void> {
  const results = await transactionsApi.bulkCreate(
    entries.map((entry) => entry.payload as CreateTransactionWire),
  )
  const byId = new Map(results.map((result) => [result.id, result]))
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    for (const entry of entries) {
      const result = byId.get(entry.id)
      if (result === undefined) continue
      if (result.status === 'invalid') {
        await flagEntry(
          entry,
          invalidItemFailure(result.errorCode, result.errorField),
        )
        continue
      }
      if (result.transaction) {
        await db.transactions.put(serverTransactionToLocal(result.transaction))
      }
      await db.outbox.delete(entry.seq)
    }
  })
}

/**
 * Push a run of queued deletes as one request — the mirror of `pushTransactionCreates`,
 * and the reason undoing a 2 608-row import is a handful of requests rather than 2 608.
 *
 * `deleted` and `missing` are terminal — the row is gone, or nothing of ours ever stood
 * behind that id — so those entries are dropped. An `invalid` one is flagged and stays
 * queued like any rejection. An entry the response does not mention stays queued, exactly
 * as on the create side, so a half-answered request leaves the rest to the next drain.
 */
export async function pushTransactionDeletes(
  entries: ReadonlyArray<OutboxEntry>,
): Promise<void> {
  const results = await transactionsApi.bulkDelete(
    entries.map((entry) => entry.id),
  )
  const byId = new Map(results.map((result) => [result.id, result]))
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    for (const entry of entries) {
      const result = byId.get(entry.id)
      if (result === undefined) continue
      if (result.status === 'invalid') {
        await flagEntry(
          entry,
          invalidItemFailure(result.errorCode, result.errorField),
        )
        continue
      }
      await db.transactions.delete(entry.id)
      await db.outbox.delete(entry.seq)
    }
  })
}

async function pushTransactionUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const tx = await transactionsApi.update(
      id,
      entry.payload as UpdateTransactionWire,
    )
    await db.transaction('rw', db.transactions, db.outbox, async () => {
      await db.transactions.put(serverTransactionToLocal(tx))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseTransaction(entry)
    if (status === 404) {
      await db.transaction('rw', db.transactions, db.outbox, async () => {
        await db.transactions.delete(id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function rebaseTransaction(entry: OutboxEntry): Promise<void> {
  const fresh = (await transactionsApi.list()).find((t) => t.id === entry.id)
  const local = await db.transactions.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const tx = await transactionsApi.update(
      entry.id,
      localTransactionToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction('rw', db.transactions, db.outbox, async () => {
      await db.transactions.put(serverTransactionToLocal(tx))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await db.transaction('rw', db.transactions, db.outbox, async () => {
      await db.transactions.put(serverTransactionToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushTransactionDelete(entry: OutboxEntry): Promise<void> {
  try {
    await transactionsApi.remove(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    await db.transactions.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

// --- Budgets -------------------------------------------------------------------------

async function pushBudgetCreate(entry: OutboxEntry): Promise<void> {
  try {
    const budget = await budgetsApi.create(entry.payload as CreateBudgetWire)
    await db.transaction('rw', db.budgets, db.outbox, async () => {
      await db.budgets.put(serverBudgetToLocal(budget))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) {
      await db.outbox.delete(entry.seq)
      await pullBudgets()
      return
    }
    throw e
  }
}

async function pushBudgetUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const budget = await budgetsApi.update(
      id,
      entry.payload as UpdateBudgetWire,
    )
    await db.transaction('rw', db.budgets, db.outbox, async () => {
      await db.budgets.put(serverBudgetToLocal(budget))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseBudget(entry)
    if (status === 404) {
      await db.transaction('rw', db.budgets, db.outbox, async () => {
        await db.budgets.delete(id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function rebaseBudget(entry: OutboxEntry): Promise<void> {
  const fresh = (await budgetsApi.list()).find((b) => b.id === entry.id)
  const local = await db.budgets.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const budget = await budgetsApi.update(
      entry.id,
      localBudgetToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction('rw', db.budgets, db.outbox, async () => {
      await db.budgets.put(serverBudgetToLocal(budget))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await db.transaction('rw', db.budgets, db.outbox, async () => {
      await db.budgets.put(serverBudgetToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushBudgetDelete(entry: OutboxEntry): Promise<void> {
  try {
    await budgetsApi.remove(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.budgets, db.outbox, async () => {
    await db.budgets.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

// --- Engine plug-ins -----------------------------------------------------------------

/** Push one transaction/budget outbox entry. Throws on network/unexpected errors. */
export async function pushSpendingEntry(entry: OutboxEntry): Promise<void> {
  if (entry.entity === 'transaction') {
    if (entry.op === 'create') return pushTransactionCreate(entry)
    if (entry.op === 'update') return pushTransactionUpdate(entry)
    return pushTransactionDelete(entry)
  }
  if (entry.op === 'create') return pushBudgetCreate(entry)
  if (entry.op === 'update') return pushBudgetUpdate(entry)
  return pushBudgetDelete(entry)
}

/** Server truth for one row — unless the local copy is holding work not yet pushed. */
async function upsertTransactionFromServer(t: Transaction): Promise<void> {
  const local = await db.transactions.get(t.id)
  if (!local || (local.dirty === 0 && local.deleted === 0)) {
    await db.transactions.put(serverTransactionToLocal(t))
  }
}

/**
 * Drop a row the server no longer has. One holding an unpushed edit stays: its own push
 * settles it, and the 404 that earns is what finally removes it.
 */
async function dropTransactionLocally(id: string): Promise<void> {
  const local = await db.transactions.get(id)
  if (local && local.dirty === 0) await db.transactions.delete(id)
}

export async function pullTransactions(): Promise<void> {
  const server = await transactionsApi.list()
  const ids = new Set(server.map((t) => t.id))
  await db.transaction('rw', db.transactions, async () => {
    for (const t of server) await upsertTransactionFromServer(t)
    for (const l of await db.transactions.toArray()) {
      if (!ids.has(l.id)) await dropTransactionLocally(l.id)
    }
  })
}

export async function pullBudgets(): Promise<void> {
  const server = await budgetsApi.list()
  const ids = new Set(server.map((b) => b.id))
  await db.transaction('rw', db.budgets, async () => {
    for (const b of server) {
      const local = await db.budgets.get(b.id)
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.budgets.put(serverBudgetToLocal(b))
      }
    }
    for (const l of await db.budgets.toArray()) {
      if (l.dirty === 0 && !ids.has(l.id)) await db.budgets.delete(l.id)
    }
  })
}

/**
 * One page of the ledger's delta, under the full pull's rules restricted to its rows.
 *
 * Every write is keyed by id, which is what makes the rows a delta deliberately re-delivers
 * around the watermark free, and a re-run of an interrupted page indistinguishable from the
 * first.
 */
async function applyTransactionChanges(
  items: ReadonlyArray<Transaction>,
  deletedIds: ReadonlyArray<string>,
): Promise<void> {
  await db.transaction('rw', db.transactions, async () => {
    for (const t of items) await upsertTransactionFromServer(t)
    for (const id of deletedIds) await dropTransactionLocally(id)
  })
}

/** The ledger's incremental pull — the one collection that grows without bound. */
export const pullTransactionsDelta = (): Promise<void> =>
  pullDelta<Transaction>({
    entity: 'transaction',
    fetchChanges: transactionsApi.changes,
    apply: applyTransactionChanges,
    idOf: (t) => t.id,
    fullPull: pullTransactions,
    reconcile: async (delivered) => {
      await db.transaction('rw', db.transactions, async () => {
        for (const l of await db.transactions.toArray()) {
          if (!delivered.has(l.id)) await dropTransactionLocally(l.id)
        }
      })
    },
  })

export async function pullSpendingAll(): Promise<void> {
  await Promise.all([pullTransactionsDelta(), pullBudgets()])
}
