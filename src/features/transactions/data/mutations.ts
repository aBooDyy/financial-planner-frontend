import { db } from '#/db/db'
import { requeued } from '#/db/syncFailure'
import { schedulePush } from '#/db/sync'
import { newId } from '#/lib/uuid'
import type { LocalBudget, LocalTransaction, OutboxEntity } from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import { closeCovered, reopenUnderSettled } from '#/features/planned/data/rows'
import {
  restoreReleasedBy,
  stepNextDueBack,
} from '#/features/planning/actions/paymentUndo'
import type {
  AdjustmentType,
  BudgetPeriod,
  BudgetScope,
  TxType,
} from '#/features/transactions/api/types'
import { isAdjustment } from '#/features/transactions/api/types'
import {
  localBudgetToCreateWire,
  localBudgetToUpdateWire,
  localTransactionToCreateWire,
  localTransactionToUpdateWire,
} from './mappers'

const now = () => new Date().toISOString()
const pending = (entity: OutboxEntity, id: string) =>
  db.outbox.where('[entity+id]').equals([entity, id])

/** Queue/refresh a create-or-update for a record that already has a pending op, else add update. */
async function enqueueUpsert(
  entity: OutboxEntity,
  id: string,
  version: string,
  createPayload: unknown,
  updatePayload: unknown,
): Promise<void> {
  const entries = await pending(entity, id).toArray()
  const create = entries.find((e) => e.op === 'create')
  if (create) {
    create.payload = createPayload
    await db.outbox.put(requeued(create))
    return
  }
  const update = entries.find((e) => e.op === 'update')
  if (update) {
    update.payload = updatePayload
    update.baseVersion = version
    await db.outbox.put(requeued(update))
    return
  }
  await db.outbox.add({
    op: 'update',
    entity,
    id,
    payload: updatePayload,
    baseVersion: version,
    createdAt: now(),
  })
}

// --- Transactions --------------------------------------------------------------------

export type TransactionDraft = {
  type: TxType
  amount: number
  currency: CurrencyCode
  /** The leaf category: a subcategory's id when one was picked, else the root's. */
  categoryId: string
  walletId: string
  /** Money used from this goal. */
  goalId: string | null
  /** A payment for this bill. Undefined on update leaves the link alone. */
  billId?: string | null
  /** Undefined on update means "leave it alone"; null clears the link. */
  merchantId?: string | null
  date: string
  note: string | null
  source?: string | null
  /** The planned item this settles. Undefined on update leaves the link alone. */
  plannedId?: string | null
}

/**
 * A balance adjustment: the gap between a wallet's derived balance and its real one. It is
 * always in the wallet's currency and links to nothing.
 */
export type AdjustmentDraft = {
  type: AdjustmentType
  amount: number
  currency: CurrencyCode
  walletId: string
  date: string
  note: string | null
  source?: string | null
}

/** Anything written as one ordinary ledger row. */
export type LedgerDraft = TransactionDraft | AdjustmentDraft

const isAdjustmentDraft = (d: LedgerDraft): d is AdjustmentDraft =>
  isAdjustment(d.type)

type Links = Required<
  Pick<
    LocalTransaction,
    'categoryId' | 'goalId' | 'billId' | 'merchantId' | 'plannedId'
  >
>

const NO_LINKS: Links = {
  categoryId: null,
  goalId: null,
  billId: null,
  merchantId: null,
  plannedId: null,
}

const linksOf = (draft: LedgerDraft): Links =>
  isAdjustmentDraft(draft)
    ? NO_LINKS
    : {
        categoryId: draft.categoryId,
        goalId: draft.goalId,
        billId: draft.billId ?? null,
        merchantId: draft.merchantId ?? null,
        plannedId: draft.plannedId ?? null,
      }

const buildTransaction = (
  id: string,
  draft: LedgerDraft,
  ts: string,
): LocalTransaction => ({
  id,
  type: draft.type,
  amount: draft.amount,
  currency: draft.currency,
  ...linksOf(draft),
  walletId: draft.walletId,
  date: draft.date,
  note: draft.note,
  source: draft.source ?? null,
  transferId: null,
  createdAt: ts,
  updatedAt: ts,
  version: '',
  dirty: 1,
  deleted: 0,
})

/** Insert a ledger row under a caller-supplied id (used by the auto-poster for idempotency). */
export async function addTransactionWithId(
  id: string,
  draft: LedgerDraft,
): Promise<void> {
  const ts = now()
  const tx = buildTransaction(id, draft, ts)
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    if (await db.transactions.get(id)) return // already posted — idempotent
    await db.transactions.put(tx)
    await db.outbox.add({
      op: 'create',
      entity: 'transaction',
      id,
      payload: localTransactionToCreateWire(tx),
      baseVersion: null,
      createdAt: ts,
    })
  })
  await closeCovered([tx.plannedId])
  schedulePush()
}

export async function createTransaction(
  draft: TransactionDraft,
): Promise<string> {
  const id = newId()
  await addTransactionWithId(id, draft)
  return id
}

export async function updateTransaction(
  id: string,
  draft: TransactionDraft,
): Promise<void> {
  const existing = await db.transactions.get(id)
  if (!existing) return
  const tx: LocalTransaction = {
    ...existing,
    type: draft.type,
    amount: draft.amount,
    currency: draft.currency,
    categoryId: draft.categoryId,
    walletId: draft.walletId,
    goalId: draft.goalId,
    billId:
      draft.billId !== undefined ? draft.billId : (existing.billId ?? null),
    merchantId:
      draft.merchantId !== undefined ? draft.merchantId : existing.merchantId,
    date: draft.date,
    note: draft.note,
    source: draft.source ?? existing.source,
    plannedId:
      draft.plannedId !== undefined ? draft.plannedId : existing.plannedId,
    updatedAt: now(),
    dirty: 1,
  }
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    await db.transactions.put(tx)
    await enqueueUpsert(
      'transaction',
      id,
      tx.version,
      localTransactionToCreateWire(tx),
      localTransactionToUpdateWire(tx),
    )
  })
  await reopenUnderSettled([existing.plannedId])
  await closeCovered([tx.plannedId])
  schedulePush()
}

export async function createAdjustment(
  draft: AdjustmentDraft,
): Promise<string> {
  const id = newId()
  await addTransactionWithId(id, draft)
  return id
}

/** Rewrites an adjustment in place. A row never crosses between cash flow and adjustment. */
export async function updateAdjustment(
  id: string,
  draft: AdjustmentDraft,
): Promise<void> {
  const existing = await db.transactions.get(id)
  if (!existing || !isAdjustment(existing.type)) return
  const tx: LocalTransaction = {
    ...existing,
    type: draft.type,
    amount: draft.amount,
    currency: draft.currency,
    walletId: draft.walletId,
    date: draft.date,
    note: draft.note,
    source: draft.source ?? existing.source,
    updatedAt: now(),
    dirty: 1,
  }
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    await db.transactions.put(tx)
    await enqueueUpsert(
      'transaction',
      id,
      tx.version,
      localTransactionToCreateWire(tx),
      localTransactionToUpdateWire(tx),
    )
  })
  schedulePush()
}

export async function deleteTransaction(id: string): Promise<void> {
  const plannedId = (await db.transactions.get(id))?.plannedId
  await deleteRecord('transaction', id, db.transactions)
  await reopenUnderSettled([plannedId])
  schedulePush()
}

/**
 * Write many transactions and their outbox creates in **one** Dexie transaction. Rows that
 * already exist are left as they are, so a retried import writes nothing twice.
 *
 * No push is scheduled: the importer commits in chunks and pushes once for the whole batch,
 * which is the difference between one debounced flush and one per chunk.
 */
export async function bulkAddTransactions(
  entries: ReadonlyArray<{ id: string; draft: LedgerDraft }>,
): Promise<number> {
  if (entries.length === 0) return 0
  const ts = now()
  return db.transaction('rw', db.transactions, db.outbox, async () => {
    const existing = new Set(
      (await db.transactions.bulkGet(entries.map((e) => e.id)))
        .filter((row) => row !== undefined)
        .map((row) => row.id),
    )
    const rows = entries
      .filter((entry) => !existing.has(entry.id))
      .map((entry) => buildTransaction(entry.id, entry.draft, ts))
    await db.transactions.bulkPut(rows)
    await db.outbox.bulkAdd(
      rows.map((tx) => ({
        op: 'create' as const,
        entity: 'transaction' as const,
        id: tx.id,
        payload: localTransactionToCreateWire(tx),
        baseVersion: null,
        createdAt: ts,
      })),
    )
    return rows.length
  })
}

/**
 * Delete many transactions in one Dexie transaction, dropping a row whose create is still
 * queued outright rather than queueing a delete for something the server never saw. Like
 * `bulkAddTransactions`, it schedules no push — the caller pushes once. A payment among them
 * gives back what it released and steps its bill's `nextDue` back, as a single delete does.
 */
export async function bulkDeleteTransactions(
  ids: ReadonlyArray<string>,
): Promise<number> {
  if (ids.length === 0) return 0
  const ts = now()
  const plannedIds = (await db.transactions.bulkGet([...ids])).map(
    (t) => t?.plannedId,
  )
  await restoreReleasedBy(ids)
  const removed = await db.transaction(
    'rw',
    db.transactions,
    db.outbox,
    async () => {
      const queued = await db.outbox
        .where('[entity+id]')
        .anyOf(ids.map((id) => ['transaction', id]))
        .toArray()
      const neverSynced = new Set(
        queued.filter((e) => e.op === 'create').map((e) => e.id),
      )
      await db.outbox.bulkDelete(
        queued.map((entry) => entry.seq).filter((seq) => seq !== undefined),
      )
      await db.transactions.bulkDelete([...ids])
      await db.outbox.bulkAdd(
        ids
          .filter((id) => !neverSynced.has(id))
          .map((id) => ({
            op: 'delete' as const,
            entity: 'transaction' as const,
            id,
            payload: null,
            baseVersion: null,
            createdAt: ts,
          })),
      )
      return ids.length
    },
  )
  await reopenUnderSettled(plannedIds)
  await stepNextDueBack(plannedIds)
  return removed
}

// --- Budgets -------------------------------------------------------------------------

export type BudgetDraft = {
  scopeType: BudgetScope
  /** A root category's id; read only for a 'category' budget. */
  categoryId: string | null
  /** Read only for a 'wallet' budget. */
  walletId: string | null
  period: BudgetPeriod
  customDays: number | null
  limit: number
  currency: CurrencyCode
  /** "Leave out planned bills"; undefined keeps the stored choice (a new budget: off). */
  excludesBills?: boolean
}

const buildBudget = (
  id: string,
  d: BudgetDraft,
  ts: string,
  excludesBills = false,
): LocalBudget => ({
  id,
  scopeType: d.scopeType,
  categoryId: d.scopeType === 'category' ? d.categoryId : null,
  walletId: d.scopeType === 'wallet' ? d.walletId : null,
  period: d.period,
  customDays: d.period === 'custom' ? d.customDays : null,
  limit: d.limit,
  currency: d.currency,
  excludesBills: d.excludesBills ?? excludesBills,
  createdAt: ts,
  updatedAt: ts,
  version: '',
  dirty: 1,
  deleted: 0,
})

export async function createBudget(draft: BudgetDraft): Promise<string> {
  const id = newId()
  const ts = now()
  const budget = buildBudget(id, draft, ts)
  await db.transaction('rw', db.budgets, db.outbox, async () => {
    await db.budgets.put(budget)
    await db.outbox.add({
      op: 'create',
      entity: 'budget',
      id,
      payload: localBudgetToCreateWire(budget),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
  return id
}

export async function updateBudget(
  id: string,
  draft: BudgetDraft,
): Promise<void> {
  const existing = await db.budgets.get(id)
  if (!existing) return
  const budget: LocalBudget = {
    ...buildBudget(
      id,
      draft,
      existing.createdAt,
      existing.excludesBills ?? false,
    ),
    createdAt: existing.createdAt,
    version: existing.version,
    updatedAt: now(),
  }
  await db.transaction('rw', db.budgets, db.outbox, async () => {
    await db.budgets.put(budget)
    await enqueueUpsert(
      'budget',
      id,
      budget.version,
      localBudgetToCreateWire(budget),
      localBudgetToUpdateWire(budget),
    )
  })
  schedulePush()
}

export async function deleteBudget(id: string): Promise<void> {
  await deleteRecord('budget', id, db.budgets)
}

/**
 * A deleted goal or bill leaves its ledger rows standing with the link cleared, as the server
 * does on delete. Local rows change here; a queued payload naming it is rewritten so its push
 * is not refused. Nothing new is queued: the server makes the same change itself.
 */
export async function unlinkLedgerFrom(
  link: 'goalId' | 'billId',
  id: string,
): Promise<void> {
  const wire = link === 'goalId' ? 'goal_id' : 'bill_id'
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    await db.transactions
      .where(link)
      .equals(id)
      .modify((t) => {
        t[link] = null
      })
    await db.outbox
      .filter(
        (e) =>
          e.entity === 'transaction' &&
          !!e.payload &&
          (e.payload as Record<string, unknown>)[wire] === id,
      )
      .modify((e) => {
        e.payload = { ...(e.payload as object), [wire]: null }
      })
  })
}

// --- Shared --------------------------------------------------------------------------

async function deleteRecord(
  entity: OutboxEntity,
  id: string,
  table: typeof db.transactions | typeof db.budgets,
): Promise<void> {
  const entries = await pending(entity, id).toArray()
  const neverSynced = entries.some((e) => e.op === 'create')
  await db.transaction('rw', table, db.outbox, async () => {
    await pending(entity, id).delete()
    await table.delete(id)
    if (!neverSynced) {
      await db.outbox.add({
        op: 'delete',
        entity,
        id,
        payload: null,
        baseVersion: null,
        createdAt: now(),
      })
    }
  })
  schedulePush()
}
