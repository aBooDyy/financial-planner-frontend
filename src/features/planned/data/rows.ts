/**
 * Local writes of planned rows and their outbox entries — the one place that knows how a
 * planned row is persisted. Deliberately free of any other feature's modules, so the
 * settlement slices (transactions, goal allocations) can call back into it without a cycle.
 * Nothing here schedules a push; callers push once for the whole change.
 */
import { db } from '#/db/db'
import { requeued } from '#/db/syncFailure'
import type {
  LocalGoalAllocation,
  LocalPlanned,
  LocalTransaction,
} from '#/db/types'
import { mergeRates } from '#/lib/config/rates'
import { localPlannedToCreateWire, localPlannedToUpdateWire } from './mappers'
import { indexSettlements, settledOf } from './settle'

const now = () => new Date().toISOString()

export const pendingPlanned = (id: string) =>
  db.outbox.where('[entity+id]').equals(['planned', id])

/** Insert rows that do not exist yet, each with its outbox create. Returns how many. */
export async function insertPlanned(
  rows: ReadonlyArray<LocalPlanned>,
): Promise<number> {
  if (rows.length === 0) return 0
  return db.transaction('rw', db.plannedTransactions, db.outbox, async () => {
    const held = new Set(
      (await db.plannedTransactions.bulkGet(rows.map((r) => r.id)))
        .filter((r) => r !== undefined)
        .map((r) => r.id),
    )
    const fresh = rows.filter((r) => !held.has(r.id))
    await db.plannedTransactions.bulkPut(fresh)
    await db.outbox.bulkAdd(
      fresh.map((row) => ({
        op: 'create' as const,
        entity: 'planned' as const,
        id: row.id,
        payload: localPlannedToCreateWire(row),
        baseVersion: null,
        createdAt: row.createdAt,
      })),
    )
    return fresh.length
  })
}

/** Write a changed row and fold the change into its queued create/update, or queue one. */
export async function savePlanned(row: LocalPlanned): Promise<void> {
  const saved: LocalPlanned = { ...row, updatedAt: now(), dirty: 1 }
  await db.transaction('rw', db.plannedTransactions, db.outbox, async () => {
    await db.plannedTransactions.put(saved)
    const entries = await pendingPlanned(saved.id).toArray()
    const create = entries.find((e) => e.op === 'create')
    if (create) {
      create.payload = localPlannedToCreateWire(saved)
      await db.outbox.put(requeued(create))
      return
    }
    const update = entries.find((e) => e.op === 'update')
    if (update) {
      update.payload = localPlannedToUpdateWire(saved)
      update.baseVersion = saved.version
      await db.outbox.put(requeued(update))
      return
    }
    await db.outbox.add({
      op: 'update',
      entity: 'planned',
      id: saved.id,
      payload: localPlannedToUpdateWire(saved),
      baseVersion: saved.version,
      createdAt: saved.updatedAt,
    })
  })
}

/** Remove a row; the server only hears about it if it ever saw the row. */
export async function removePlanned(ids: ReadonlyArray<string>): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', db.plannedTransactions, db.outbox, async () => {
    for (const id of ids) {
      const entries = await pendingPlanned(id).toArray()
      const neverSynced = entries.some((e) => e.op === 'create')
      await pendingPlanned(id).delete()
      await db.plannedTransactions.delete(id)
      if (!neverSynced) {
        await db.outbox.add({
          op: 'delete',
          entity: 'planned',
          id,
          payload: null,
          baseVersion: null,
          createdAt: now(),
        })
      }
    }
  })
}

/** The live transactions and reservations that point at any of `plannedIds`. */
export async function settlementsOf(
  plannedIds: ReadonlyArray<string>,
): Promise<{
  txns: LocalTransaction[]
  allocations: LocalGoalAllocation[]
}> {
  const ids = [...plannedIds]
  const [txns, allocations] = await Promise.all([
    db.transactions.where('plannedId').anyOf(ids).toArray(),
    db.goalAllocations.where('plannedId').anyOf(ids).toArray(),
  ])
  return {
    txns: txns.filter((t) => t.deleted === 0),
    allocations: allocations.filter((a) => a.deleted === 0),
  }
}

/** The user's rate overrides over the shipped seed — what every settled sum converts with. */
export const currentRates = async () =>
  mergeRates(await db.exchangeRates.toArray())

/**
 * Status is re-derived when a settlement goes away: an item marked done whose settlements no
 * longer cover it opens again. Called by every path that deletes or re-points a settlement.
 */
export async function reopenUnderSettled(
  plannedIds: ReadonlyArray<string | null | undefined>,
): Promise<number> {
  const ids = [...new Set(plannedIds.filter((id): id is string => !!id))]
  if (ids.length === 0) return 0
  const items = (await db.plannedTransactions.bulkGet(ids)).filter(
    (p): p is LocalPlanned => !!p && p.status === 'done',
  )
  if (items.length === 0) return 0
  const { txns, allocations } = await settlementsOf(items.map((p) => p.id))
  const index = indexSettlements(txns, allocations)
  const rates = await currentRates()
  const reopen = items.filter(
    (item) => settledOf(item, index, rates) < item.amount,
  )
  for (const item of reopen) await savePlanned({ ...item, status: 'open' })
  return reopen.length
}

/**
 * The other half of the same rule: an open item whose settlements now cover it is done.
 * Called by every path that writes a settlement, so saving a transaction that settles a
 * planned item closes it exactly as confirming the item would.
 */
export async function closeCovered(
  plannedIds: ReadonlyArray<string | null | undefined>,
): Promise<number> {
  const ids = [...new Set(plannedIds.filter((id): id is string => !!id))]
  if (ids.length === 0) return 0
  const items = (await db.plannedTransactions.bulkGet(ids)).filter(
    (p): p is LocalPlanned => !!p && p.status === 'open',
  )
  if (items.length === 0) return 0
  const { txns, allocations } = await settlementsOf(items.map((p) => p.id))
  const index = indexSettlements(txns, allocations)
  const rates = await currentRates()
  const covered = items.filter(
    (item) => settledOf(item, index, rates) >= item.amount,
  )
  for (const item of covered) await savePlanned({ ...item, status: 'done' })
  return covered.length
}
