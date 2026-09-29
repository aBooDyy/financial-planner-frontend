import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

/**
 * The schema is declared once, at its current version. What is worth pinning is the shape
 * that declaration produces — every table the app reads, the indexes the features actually
 * query by — and the one-off wipe the version-2 upgrade performs.
 */

describe('the local database', () => {
  it('opens at version 3 with every table the app reads', async () => {
    const { db } = await import('./db')
    await db.open()

    expect(db.verno).toBe(3)
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'appConfig',
      'balanceNodes',
      'balanceSettings',
      'budgets',
      'categories',
      'customCurrencies',
      'emailConnections',
      'exchangeRates',
      'goalAllocations',
      'goals',
      'importBatches',
      'importTemplates',
      'inboundImports',
      'incomeStreams',
      'integrationKeys',
      'ledgerTotals',
      'merchantAliases',
      'merchants',
      'outbox',
      'plannedTransactions',
      'recurrings',
      'syncState',
      'transactions',
    ])
  })

  it('indexes `source` on transactions, which is what makes an import undoable', async () => {
    const { db } = await import('./db')
    await db.transactions.put({
      id: 'tx-1',
      type: 'spend',
      amount: 1240,
      currency: 'SAR',
      categoryId: 'cat-groceries',
      walletId: 'w1',
      goalId: null,
      merchantId: null,
      date: '2026-05-01',
      note: null,
      source: 'csv:batch-1',
      transferId: null,
      plannedId: null,
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
      version: 'v1',
      dirty: 0,
      deleted: 0,
    })

    const batch = await db.transactions
      .where('source')
      .equals('csv:batch-1')
      .toArray()

    expect(batch).toHaveLength(1)
    await db.transactions.clear()
  })

  it('wipes the delta watermarks along with the data on sign-out', async () => {
    const { clearLocalDb, db } = await import('./db')
    await db.syncState.put({
      id: 'user-a:transaction',
      since: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    })

    await clearLocalDb()

    expect(await db.syncState.count()).toBe(0)
  })

  it('finds a planned item’s settlements by `plannedId` on both settlement tables', async () => {
    const { db } = await import('./db')
    const { settlementsOf } = await import('#/features/planned/data/rows')
    await db.transactions.put({
      id: 'tx-p',
      type: 'spend',
      amount: 100,
      currency: 'SAR',
      categoryId: 'cat-housing',
      walletId: 'w1',
      goalId: null,
      merchantId: null,
      date: '2026-09-01',
      note: null,
      source: null,
      transferId: null,
      plannedId: 'p-1',
      createdAt: '',
      updatedAt: '',
      version: 'v1',
      dirty: 0,
      deleted: 0,
    })
    await db.goalAllocations.put({
      id: 'a-p',
      goalId: 'g1',
      source: 'external',
      walletId: null,
      externalLabel: 'Dad',
      amount: 50,
      currency: 'SAR',
      note: null,
      position: 0,
      date: '2026-09-01',
      plannedId: 'p-1',
      createdAt: '',
      updatedAt: '',
      version: 'v1',
      dirty: 0,
      deleted: 0,
    })

    const found = await settlementsOf(['p-1'])

    expect(found.txns.map((t) => t.id)).toEqual(['tx-p'])
    expect(found.allocations.map((a) => a.id)).toEqual(['a-p'])
    await Promise.all([db.transactions.clear(), db.goalAllocations.clear()])
  })

  it('indexes `categoryId` on the three ledger tables a category re-file walks', async () => {
    const { db } = await import('./db')
    await db.open()

    const indexed = (table: string) =>
      db.table(table).schema.indexes.map((i) => i.name)

    expect(indexed('transactions')).toContain('categoryId')
    expect(indexed('recurrings')).toContain('categoryId')
    expect(indexed('plannedTransactions')).toContain('categoryId')
  })

  it('wipes synced rows, the outbox and the watermarks when upgrading from version 1', async () => {
    const name = 'upgrade-from-v1'
    const v1 = new Dexie(name)
    v1.version(1).stores({
      appConfig: 'id',
      categories: 'id, slug, parentId, dirty, deleted',
      transactions:
        'id, walletId, goalId, merchantId, transferId, date, source, plannedId, dirty, deleted',
      importBatches: 'id, createdAt',
      syncState: 'id',
      outbox: '++seq, [entity+id]',
    })
    await v1.open()
    await v1.table('appConfig').put({ id: 'me', config: {}, fetchedAt: '' })
    await v1
      .table('categories')
      .put({ id: 'c1', slug: 'dining', parentId: null })
    await v1.table('transactions').put({ id: 't1', category: 'dining' })
    await v1.table('importBatches').put({ id: 'b1', createdAt: '' })
    await v1.table('syncState').put({ id: 'u:transaction', since: 'x' })
    await v1
      .table('outbox')
      .add({ entity: 'transaction', id: 't1', op: 'create' })
    v1.close()

    const { AppDatabase } = await import('./db')
    const upgraded = new AppDatabase(name)
    await upgraded.open()

    expect(upgraded.verno).toBe(3)
    expect(await upgraded.categories.count()).toBe(0)
    expect(await upgraded.transactions.count()).toBe(0)
    expect(await upgraded.syncState.count()).toBe(0)
    expect(await upgraded.outbox.count()).toBe(0)
    expect(await upgraded.appConfig.count()).toBe(1)
    expect(await upgraded.importBatches.count()).toBe(1)
    upgraded.close()
  })
})
