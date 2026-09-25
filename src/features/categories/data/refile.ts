import type { EntityTable } from 'dexie'
import { db } from '#/db/db'
import type { LocalCategory, OutboxEntity } from '#/db/types'

/**
 * The slug pair a row is filed under. A root category's filing has no subcategory, which as
 * a source means "any of its subcategories".
 */
export type Filing = { category: string; subcategory: string | null }

type FiledRow = {
  id: string
  category: string | null
  subcategory: string | null
  deleted: number
}

/** Every table `refileLocally` writes — a caller's Dexie transaction must include them. */
export const refileTables = () => [
  db.transactions,
  db.recurrings,
  db.plannedTransactions,
  db.outbox,
]

export async function filingOf(
  category: LocalCategory,
): Promise<Filing | null> {
  if (category.parentId === null) {
    return { category: category.slug, subcategory: null }
  }
  const parent = await db.categories.get(category.parentId)
  return parent ? { category: parent.slug, subcategory: category.slug } : null
}

const isFiledUnder = (row: FiledRow, source: Filing): boolean =>
  row.category === source.category &&
  (source.subcategory === null || row.subcategory === source.subcategory)

/**
 * Mirror the server's re-file on this device: every row filed under `source` moves to
 * `target`. A synced row is rewritten without an outbox op of its own — the category's
 * delete re-files it server-side, and the delta brings its new version back. A row with a
 * queued create or update has that payload rewritten too, or its push would re-file it back.
 */
export async function refileLocally(
  source: Filing,
  target: Filing,
): Promise<void> {
  await refileTable(db.transactions, 'transaction', source, target)
  await refileTable(db.recurrings, 'recurring', source, target)
  await refileTable(db.plannedTransactions, 'planned', source, target)
}

async function refileTable<T extends FiledRow>(
  table: EntityTable<T, 'id'>,
  entity: OutboxEntity,
  source: Filing,
  target: Filing,
): Promise<void> {
  const ids = await table
    .filter((row) => row.deleted === 0 && isFiledUnder(row, source))
    .primaryKeys()
  if (ids.length === 0) return
  await table
    .where(':id')
    .anyOf(ids)
    .modify((row) => {
      row.category = target.category
      row.subcategory = target.subcategory
    })
  for (const id of ids) await refileQueued(entity, id, target)
}

async function refileQueued(
  entity: OutboxEntity,
  id: string,
  target: Filing,
): Promise<void> {
  const entries = await db.outbox
    .where('[entity+id]')
    .equals([entity, id])
    .toArray()
  for (const entry of entries) {
    const payload = entry.payload
    if (payload === null || typeof payload !== 'object') continue
    if (!('category' in payload)) continue
    await db.outbox.put({
      ...entry,
      payload: {
        ...payload,
        category: target.category,
        subcategory: target.subcategory,
      },
    })
  }
}
