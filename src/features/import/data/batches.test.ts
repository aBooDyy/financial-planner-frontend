import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { buildRows } from './csv/rows'
import { testContext, testMapping } from './__fixtures__/mapping'
import { moneyLover } from './__fixtures__/moneyLover'
import { rowReader, scanRowsSync } from './rowScan'

const schedulePush = vi.fn()
vi.mock('#/db/sync', () => ({ schedulePush: () => schedulePush() }))

const { commitImport, rowsSource } = await import('./commit')
const { batchIdFromSource, batchSource, planUndo, undoImport } =
  await import('./batches')
const { createTransaction, updateTransaction } =
  await import('#/features/transactions/data/mutations')

const meta = {
  label: 'statement.csv',
  templateId: null,
  rowCount: 4,
  errorCount: 0,
}

const matrix = [
  ['2026-06-16', 'Bakery', '-12.40'],
  ['2026-06-17', 'Fuel', '-90.00'],
  ['2026-06-18', 'Coffee', '-8.50'],
  ['2026-06-19', 'Books', '-45.00'],
]

const commitFixture = async () => {
  const mapping = testMapping()
  return commitImport(
    rowsSource(buildRows(matrix, mapping, testContext())),
    mapping,
    meta,
  )
}

/** Pretend the sync engine drained: the row now has a server version and nothing queued. */
const markSynced = async (ids: ReadonlyArray<string>) => {
  await db.outbox
    .where('[entity+id]')
    .anyOf(ids.map((id) => ['transaction', id]))
    .delete()
  for (const id of ids) {
    await db.transactions.update(id, { version: 'server-v1', dirty: 0 })
  }
}

beforeEach(async () => {
  schedulePush.mockClear()
  await Promise.all([
    db.transactions.clear(),
    db.outbox.clear(),
    db.importBatches.clear(),
  ])
})

describe('batch markers', () => {
  it('round-trips a batch id through the source marker', () => {
    expect(batchIdFromSource(batchSource('abc'))).toBe('abc')
    expect(batchIdFromSource('email:c1')).toBeNull()
    expect(batchIdFromSource(null)).toBeNull()
  })
})

describe('undoImport', () => {
  it('removes exactly the rows the batch added', async () => {
    const other = await createTransaction({
      type: 'spend',
      amount: 500,
      currency: 'SAR',
      categoryId: 'cat-other',
      walletId: 'w1',
      goalId: null,
      date: '2026-06-16',
      note: 'Typed by hand',
    })
    const { batch } = await commitFixture()
    expect(await db.transactions.count()).toBe(5)

    const result = await undoImport(batch.id)

    expect(result).toEqual({ removed: 4, removedTransfers: 0, kept: 0 })
    expect((await db.transactions.toArray()).map((tx) => tx.id)).toEqual([
      other,
    ])
  })

  it('keeps a row the user edited after the import, and names it in the plan', async () => {
    const { batch } = await commitFixture()
    const edited = (await db.transactions.orderBy('date').first())!
    if (edited.type !== 'spend' && edited.type !== 'income') throw new Error()
    await updateTransaction(edited.id, {
      type: edited.type,
      amount: 1500,
      currency: edited.currency,
      categoryId: edited.categoryId ?? 'cat-other',
      walletId: edited.walletId,
      goalId: edited.goalId,
      date: edited.date,
      note: 'Corrected by hand',
    })

    const plan = await planUndo(batch.id)
    expect(plan?.edited.map((tx) => tx.id)).toEqual([edited.id])
    expect(plan?.removable).toHaveLength(3)

    const result = await undoImport(batch.id)

    expect(result).toEqual({ removed: 3, removedTransfers: 0, kept: 1 })
    const left = await db.transactions.toArray()
    expect(left.map((tx) => tx.id)).toEqual([edited.id])
    expect(left[0].amount).toBe(1500)
  })

  it('drops a never-synced row outright and queues a delete only for what the server has seen', async () => {
    const { batch } = await commitFixture()
    const ids = (await db.transactions.orderBy('date').toArray()).map(
      (tx) => tx.id,
    )
    await markSynced(ids.slice(0, 2))

    await undoImport(batch.id)

    const queued = await db.outbox.toArray()
    expect(queued.map((e) => e.op)).toEqual(['delete', 'delete'])
    expect(queued.map((e) => e.id).sort()).toEqual(ids.slice(0, 2).sort())
    expect(await db.transactions.count()).toBe(0)
  })

  it('keeps the batch record, marked undone, and pushes once', async () => {
    const { batch } = await commitFixture()
    schedulePush.mockClear()

    await undoImport(batch.id)

    const stored = await db.importBatches.get(batch.id)
    expect(stored?.undoneAt).toEqual(expect.any(String))
    expect(stored?.importedCount).toBe(4)
    expect(schedulePush).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a batch this device does not know', async () => {
    expect(await undoImport('missing')).toEqual({
      removed: 0,
      removedTransfers: 0,
      kept: 0,
    })
  })
})

describe('undoImport — transfers', () => {
  const commitTransfers = async () => {
    const { matrix: file, mapping, context } = moneyLover()
    const scan = scanRowsSync({
      matrix: file,
      mapping,
      context,
      merchants: { merchants: [], aliases: [] },
    })
    const reader = rowReader({
      matrix: file,
      mapping,
      context,
      merchants: { merchants: [], aliases: [] },
      pairs: scan.pairs,
    })
    return commitImport(
      rowsSource(file.map((_cells, index) => reader.at(index))),
      mapping,
      meta,
    )
  }

  it('removes each transfer whole, through the transfer delete, beside the ledger rows', async () => {
    const { batch } = await commitTransfers()
    const plan = await planUndo(batch.id)
    expect(plan?.removableTransfers).toHaveLength(3)
    expect(plan?.removable).toHaveLength(5)

    // Pretend one transfer reached the server, so it needs a delete of its own.
    const [synced] = plan!.removableTransfers
    await db.outbox.where('[entity+id]').equals(['transfer', synced]).delete()

    const result = await undoImport(batch.id)

    expect(result).toEqual({ removed: 5, removedTransfers: 3, kept: 0 })
    expect(await db.transactions.count()).toBe(0)
    expect(
      (await db.outbox.toArray()).map((e) => [e.entity, e.op, e.id]),
    ).toEqual([['transfer', 'delete', synced]])
  })

  it('keeps a transfer whole when either of its legs changed since', async () => {
    const { batch } = await commitTransfers()
    const leg = (await db.transactions
      .filter((tx) => tx.type === 'transfer_in')
      .first())!
    await db.transactions.update(leg.id, { updatedAt: 'later' })

    const plan = await planUndo(batch.id)
    expect(plan?.removableTransfers).toHaveLength(2)
    expect(plan?.edited.map((tx) => tx.transferId)).toEqual([leg.transferId])

    await undoImport(batch.id)
    expect(
      await db.transactions.where('transferId').equals(leg.transferId!).count(),
    ).toBe(2)
  })
})
