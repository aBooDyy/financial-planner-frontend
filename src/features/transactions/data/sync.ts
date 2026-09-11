import { db } from '#/db/db'
import type { OutboxEntry } from '#/db/types'
import {
  budgetsApi,
  recurringsApi,
  transactionsApi,
} from '#/features/transactions/api/transactionsApi'
import type {
  CreateBudgetWire,
  CreateRecurringWire,
  CreateTransactionWire,
  UpdateBudgetWire,
  UpdateRecurringWire,
  UpdateTransactionWire,
} from '#/features/transactions/api/types'
import { ApiError } from '#/lib/apiError'
import {
  localBudgetToUpdateWire,
  localRecurringToUpdateWire,
  localTransactionToUpdateWire,
  serverBudgetToLocal,
  serverRecurringToLocal,
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
    if (statusOf(e) === 409) {
      await db.outbox.delete(entry.seq)
      await pullTransactions()
      return
    }
    throw e
  }
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
  } catch {
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
  } catch {
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

// --- Recurring -----------------------------------------------------------------------

async function pushRecurringCreate(entry: OutboxEntry): Promise<void> {
  try {
    const r = await recurringsApi.create(entry.payload as CreateRecurringWire)
    await db.transaction('rw', db.recurrings, db.outbox, async () => {
      await db.recurrings.put(serverRecurringToLocal(r))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) {
      await db.outbox.delete(entry.seq)
      await pullRecurrings()
      return
    }
    throw e
  }
}

async function pushRecurringUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const r = await recurringsApi.update(
      id,
      entry.payload as UpdateRecurringWire,
    )
    await db.transaction('rw', db.recurrings, db.outbox, async () => {
      await db.recurrings.put(serverRecurringToLocal(r))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseRecurring(entry)
    if (status === 404) {
      await db.transaction('rw', db.recurrings, db.outbox, async () => {
        await db.recurrings.delete(id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function rebaseRecurring(entry: OutboxEntry): Promise<void> {
  const fresh = (await recurringsApi.list()).find((r) => r.id === entry.id)
  const local = await db.recurrings.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const r = await recurringsApi.update(
      entry.id,
      localRecurringToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction('rw', db.recurrings, db.outbox, async () => {
      await db.recurrings.put(serverRecurringToLocal(r))
      await db.outbox.delete(entry.seq)
    })
  } catch {
    await db.transaction('rw', db.recurrings, db.outbox, async () => {
      await db.recurrings.put(serverRecurringToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushRecurringDelete(entry: OutboxEntry): Promise<void> {
  try {
    await recurringsApi.remove(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.recurrings, db.outbox, async () => {
    await db.recurrings.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

// --- Engine plug-ins -----------------------------------------------------------------

/** Push one transaction/budget/recurring outbox entry. Throws on network/unexpected errors. */
export async function pushSpendingEntry(entry: OutboxEntry): Promise<void> {
  if (entry.entity === 'transaction') {
    if (entry.op === 'create') return pushTransactionCreate(entry)
    if (entry.op === 'update') return pushTransactionUpdate(entry)
    return pushTransactionDelete(entry)
  }
  if (entry.entity === 'budget') {
    if (entry.op === 'create') return pushBudgetCreate(entry)
    if (entry.op === 'update') return pushBudgetUpdate(entry)
    return pushBudgetDelete(entry)
  }
  if (entry.op === 'create') return pushRecurringCreate(entry)
  if (entry.op === 'update') return pushRecurringUpdate(entry)
  return pushRecurringDelete(entry)
}

export async function pullTransactions(): Promise<void> {
  const server = await transactionsApi.list()
  const ids = new Set(server.map((t) => t.id))
  await db.transaction('rw', db.transactions, async () => {
    for (const t of server) {
      const local = await db.transactions.get(t.id)
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.transactions.put(serverTransactionToLocal(t))
      }
    }
    for (const l of await db.transactions.toArray()) {
      if (l.dirty === 0 && !ids.has(l.id)) await db.transactions.delete(l.id)
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

export async function pullRecurrings(): Promise<void> {
  const server = await recurringsApi.list()
  const ids = new Set(server.map((r) => r.id))
  await db.transaction('rw', db.recurrings, async () => {
    for (const r of server) {
      const local = await db.recurrings.get(r.id)
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.recurrings.put(serverRecurringToLocal(r))
      }
    }
    for (const l of await db.recurrings.toArray()) {
      if (l.dirty === 0 && !ids.has(l.id)) await db.recurrings.delete(l.id)
    }
  })
}

export async function pullSpendingAll(): Promise<void> {
  await Promise.all([pullTransactions(), pullBudgets(), pullRecurrings()])
}
