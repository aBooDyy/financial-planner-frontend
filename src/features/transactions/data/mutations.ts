import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import type {
  LocalBudget,
  LocalRecurring,
  LocalTransaction,
  OutboxEntity,
} from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import type { GoalFrequency } from '#/features/goals/api/types'
import type {
  BudgetPeriod,
  BudgetScope,
  TxType,
} from '#/features/transactions/api/types'
import {
  localBudgetToCreateWire,
  localBudgetToUpdateWire,
  localRecurringToCreateWire,
  localRecurringToUpdateWire,
  localTransactionToCreateWire,
  localTransactionToUpdateWire,
} from './mappers'

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

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
    await db.outbox.put(create)
    return
  }
  const update = entries.find((e) => e.op === 'update')
  if (update) {
    update.payload = updatePayload
    update.baseVersion = version
    await db.outbox.put(update)
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
  category: string
  subcategory: string | null
  walletId: string
  goalId: string | null
  date: string
  note: string | null
  source?: string | null
}

const buildTransaction = (
  id: string,
  draft: TransactionDraft,
  ts: string,
): LocalTransaction => ({
  id,
  type: draft.type,
  amount: draft.amount,
  currency: draft.currency,
  category: draft.category,
  subcategory: draft.subcategory,
  walletId: draft.walletId,
  goalId: draft.goalId,
  date: draft.date,
  note: draft.note,
  source: draft.source ?? null,
  createdAt: ts,
  updatedAt: ts,
  version: '',
  dirty: 1,
  deleted: 0,
})

/** Insert a transaction under a caller-supplied id (used by the auto-poster for idempotency). */
export async function addTransactionWithId(
  id: string,
  draft: TransactionDraft,
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
    category: draft.category,
    subcategory: draft.subcategory,
    walletId: draft.walletId,
    goalId: draft.goalId,
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
  await deleteRecord('transaction', id, db.transactions)
}

// --- Budgets -------------------------------------------------------------------------

export type BudgetDraft = {
  scopeType: BudgetScope
  target: string | null
  period: BudgetPeriod
  customDays: number | null
  limit: number
  currency: CurrencyCode
}

const buildBudget = (id: string, d: BudgetDraft, ts: string): LocalBudget => ({
  id,
  scopeType: d.scopeType,
  target: d.scopeType === 'overall' ? null : d.target,
  period: d.period,
  customDays: d.period === 'custom' ? d.customDays : null,
  limit: d.limit,
  currency: d.currency,
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
    ...buildBudget(id, draft, existing.createdAt),
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

// --- Recurring -----------------------------------------------------------------------

export type RecurringDraft = {
  name: string
  type: TxType
  amount: number
  currency: CurrencyCode
  category: string
  subcategory: string | null
  walletId: string
  goalId: string | null
  frequency: GoalFrequency
  nextDue: string
  autopost: boolean
}

const buildRecurring = (
  id: string,
  d: RecurringDraft,
  ts: string,
): LocalRecurring => ({
  id,
  ...d,
  createdAt: ts,
  updatedAt: ts,
  version: '',
  dirty: 1,
  deleted: 0,
})

export async function createRecurring(draft: RecurringDraft): Promise<string> {
  const id = newId()
  const ts = now()
  const recurring = buildRecurring(id, draft, ts)
  await db.transaction('rw', db.recurrings, db.outbox, async () => {
    await db.recurrings.put(recurring)
    await db.outbox.add({
      op: 'create',
      entity: 'recurring',
      id,
      payload: localRecurringToCreateWire(recurring),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
  return id
}

export async function updateRecurring(
  id: string,
  draft: RecurringDraft,
): Promise<void> {
  await persistRecurring(id, (existing) => ({
    ...existing,
    ...draft,
    updatedAt: now(),
    dirty: 1,
  }))
}

/** Move a recurring's next-due forward (used by the auto-poster after it posts an occurrence). */
export async function advanceRecurring(
  id: string,
  nextDue: string,
): Promise<void> {
  await persistRecurring(id, (existing) => ({
    ...existing,
    nextDue,
    updatedAt: now(),
    dirty: 1,
  }))
}

export async function deleteRecurring(id: string): Promise<void> {
  await deleteRecord('recurring', id, db.recurrings)
}

async function persistRecurring(
  id: string,
  apply: (existing: LocalRecurring) => LocalRecurring,
): Promise<void> {
  const existing = await db.recurrings.get(id)
  if (!existing) return
  const recurring = apply(existing)
  await db.transaction('rw', db.recurrings, db.outbox, async () => {
    await db.recurrings.put(recurring)
    await enqueueUpsert(
      'recurring',
      id,
      recurring.version,
      localRecurringToCreateWire(recurring),
      localRecurringToUpdateWire(recurring),
    )
  })
  schedulePush()
}

// --- Shared --------------------------------------------------------------------------

async function deleteRecord(
  entity: OutboxEntity,
  id: string,
  table: typeof db.transactions | typeof db.budgets | typeof db.recurrings,
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
