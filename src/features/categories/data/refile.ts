import type { EntityTable } from 'dexie'
import { db } from '#/db/db'
import { requeued } from '#/db/syncFailure'
import type { OutboxEntity, OutboxEntry } from '#/db/types'

/** Every table the rewrites here touch — a caller's Dexie transaction must include them. */
export const refileTables = () => [
  db.categories,
  db.transactions,
  db.recurrings,
  db.plannedTransactions,
  db.budgets,
  db.merchants,
  db.inboundImports,
  db.integrationKeys,
  db.outbox,
]

type Ids = ReadonlySet<string>

/** The id itself and, for a root, its children's — everything its delete takes with it. */
export async function subtreeIds(id: string): Promise<Set<string>> {
  const children = await db.categories.where('parentId').equals(id).toArray()
  return new Set([id, ...children.map((c) => c.id)])
}

/** Whether any live transaction, recurring or planned row is filed under one of `ids`. */
export async function isInUse(ids: Ids): Promise<boolean> {
  const keys = [...ids]
  for (const table of [
    db.transactions,
    db.recurrings,
    db.plannedTransactions,
  ]) {
    const filed = await table.where('categoryId').anyOf(keys).toArray()
    if (filed.some((row) => row.deleted === 0)) return true
  }
  return false
}

/**
 * Mirror the server's move on this device: every row filed under `from` moves to `to`, and a
 * budget on `from` moves to `toRoot` (budgets are root-scoped). A synced row is rewritten
 * without an outbox op of its own — the category's delete moves it server-side and the next
 * pull brings its new version back. A queued create or update has its payload rewritten too,
 * or its push would file the row back.
 */
export async function refileLocally(
  from: Ids,
  to: string,
  toRoot: string,
): Promise<void> {
  await moveLedger(from, to)
  await moveRefs(
    db.budgets,
    'budget',
    'categoryId',
    'category_id',
    from,
    toRoot,
  )
  await moveRefs(
    db.merchants,
    'merchant',
    'learnedCategoryId',
    'learned_category_id',
    from,
    to,
  )
  await moveCachedRefs(from, to)
}

/**
 * Mirror a delete of categories nothing is filed under: a merchant forgets them, and a budget
 * on them goes (server-side it is deleted with the category).
 */
export async function unlinkLocally(from: Ids): Promise<void> {
  await moveRefs(
    db.merchants,
    'merchant',
    'learnedCategoryId',
    'learned_category_id',
    from,
    null,
  )
  await moveCachedRefs(from, null)
  const budgets = await db.budgets
    .filter((b) => b.categoryId !== null && from.has(b.categoryId))
    .primaryKeys()
  for (const id of budgets) {
    await db.outbox.where('[entity+id]').equals(['budget', id]).delete()
  }
  await db.budgets.bulkDelete(budgets)
}

/**
 * The server already held a category this device created under another id: point every local
 * reference — rows, children and queued payloads — at the server's id instead.
 */
export async function remapLocally(
  fromId: string,
  toId: string,
): Promise<void> {
  const from = new Set([fromId])
  await moveLedger(from, toId)
  await moveRefs(db.budgets, 'budget', 'categoryId', 'category_id', from, toId)
  await moveRefs(
    db.merchants,
    'merchant',
    'learnedCategoryId',
    'learned_category_id',
    from,
    toId,
  )
  await moveRefs(db.categories, 'category', 'parentId', 'parent_id', from, toId)
}

/**
 * The read caches of server-owned rows (a key's default, a pending import's suggestion) never
 * queue anything, so they are only rewritten in place, as the server rewrites them; the next
 * pull agrees.
 */
async function moveCachedRefs(from: Ids, to: string | null): Promise<void> {
  await db.integrationKeys
    .filter(
      (k) => k.defaultCategoryId !== null && from.has(k.defaultCategoryId),
    )
    .modify({ defaultCategoryId: to })
  await db.inboundImports
    .filter(
      (i) => i.suggestedCategoryId !== null && from.has(i.suggestedCategoryId),
    )
    .modify({ suggestedCategoryId: to })
}

async function moveLedger(from: Ids, to: string): Promise<void> {
  await moveIndexed(db.transactions, 'transaction', from, to)
  await moveIndexed(db.recurrings, 'recurring', from, to)
  await moveIndexed(db.plannedTransactions, 'planned', from, to)
}

type Filed = { id: string; categoryId: string | null }

async function moveIndexed<T extends Filed>(
  table: EntityTable<T, 'id'>,
  entity: OutboxEntity,
  from: Ids,
  to: string,
): Promise<void> {
  const ids = await table
    .where('categoryId')
    .anyOf([...from])
    .primaryKeys()
  if (ids.length === 0) return
  await table
    .where(':id')
    .anyOf(ids)
    .modify((row) => {
      row.categoryId = to
    })
  for (const id of ids) {
    await rewriteQueued(entity, id, 'category_id', from, to)
  }
}

async function moveRefs<
  T extends { id: string },
  TKey extends keyof T & string,
>(
  table: EntityTable<T, 'id'>,
  entity: OutboxEntity,
  field: TKey,
  wireField: string,
  from: Ids,
  to: string | null,
): Promise<void> {
  const refersToFrom = (row: T) => {
    const value = row[field]
    return typeof value === 'string' && from.has(value)
  }
  const ids = await table.filter(refersToFrom).primaryKeys()
  if (ids.length === 0) return
  await table
    .where(':id')
    .anyOf(ids)
    .modify((row) => {
      ;(row as Record<string, unknown>)[field] = to
    })
  for (const id of ids) await rewriteQueued(entity, id, wireField, from, to)
}

/**
 * Point a row's queued payloads at `to`. The outbox pushes in `seq` order, so when `to` is a
 * category whose own create is still queued behind them, the row's entries are queued again
 * (in their order) after it — or the server would be asked to file the row under a category
 * it does not hold yet, refuse, and the row would never reach it.
 */
async function rewriteQueued(
  entity: OutboxEntity,
  id: string,
  wireField: string,
  from: Ids,
  to: string | null,
): Promise<void> {
  const entries = await db.outbox
    .where('[entity+id]')
    .equals([entity, id])
    .sortBy('seq')
  const rewritten = entries.map(
    (entry) => rewritePayload(entry, wireField, from, to) ?? entry,
  )
  if (rewritten.every((entry, i) => entry === entries[i])) return

  const targetCreate = to === null ? undefined : await queuedCreateSeq(to)
  const firstQueued = entries[0]?.seq
  if (
    targetCreate !== undefined &&
    firstQueued !== undefined &&
    firstQueued < targetCreate
  ) {
    await db.outbox.bulkDelete(entries.map((entry) => entry.seq))
    for (const { seq: _seq, ...entry } of rewritten) await db.outbox.add(entry)
    return
  }
  for (const [i, entry] of rewritten.entries()) {
    if (entry !== entries[i]) await db.outbox.put(entry)
  }
}

async function queuedCreateSeq(
  categoryId: string,
): Promise<number | undefined> {
  const create = await db.outbox
    .where('[entity+id]')
    .equals(['category', categoryId])
    .filter((entry) => entry.op === 'create')
    .first()
  return create?.seq
}

function rewritePayload(
  entry: OutboxEntry,
  wireField: string,
  from: Ids,
  to: string | null,
): OutboxEntry | null {
  const payload = entry.payload
  if (payload === null || typeof payload !== 'object') return null
  const value = (payload as Record<string, unknown>)[wireField]
  if (typeof value !== 'string' || !from.has(value)) return null
  return requeued({ ...entry, payload: { ...payload, [wireField]: to } })
}
