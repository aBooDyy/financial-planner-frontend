import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

/**
 * The schema is declared once, at its current version. What is worth pinning is the shape
 * that declaration produces — every table the app reads, the indexes the features actually
 * query by — and the one-off wipes the version-2 and version-4 upgrades perform.
 */

describe('the local database', () => {
  it('opens at version 4 with every table the app reads', async () => {
    const { db } = await import('./db')
    await db.open()

    expect(db.verno).toBe(4)
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'appConfig',
      'balanceNodes',
      'balanceSettings',
      'bills',
      'budgets',
      'categories',
      'customCurrencies',
      'emailConnections',
      'exchangeRates',
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
      'setAsides',
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
    await db.setAsides.put({
      id: 'a-p',
      goalId: 'g1',
      billId: null,
      occurrence: null,
      source: 'outside',
      walletId: null,
      externalLabel: 'Dad',
      amount: 50,
      currency: 'SAR',
      note: null,
      position: 0,
      date: '2026-09-01',
      plannedId: 'p-1',
      releasedAt: null,
      releasedById: null,
      movedByTransferId: null,
      createdAt: '',
      updatedAt: '',
      version: 'v1',
      dirty: 0,
      deleted: 0,
    })

    const found = await settlementsOf(['p-1'])

    expect(found.txns.map((t) => t.id)).toEqual(['tx-p'])
    expect(found.setAsides.map((a) => a.id)).toEqual(['a-p'])
    await Promise.all([db.transactions.clear(), db.setAsides.clear()])
  })

  it('indexes `categoryId` on the three tables a category re-file walks', async () => {
    const { db } = await import('./db')
    await db.open()

    const indexed = (table: string) =>
      db.table(table).schema.indexes.map((i) => i.name)

    expect(indexed('transactions')).toContain('categoryId')
    expect(indexed('bills')).toContain('categoryId')
    expect(indexed('plannedTransactions')).toContain('categoryId')
  })

  it('indexes the planning links the planner and set-aside reads walk', async () => {
    const { db } = await import('./db')
    await db.open()

    const indexed = (table: string) =>
      db.table(table).schema.indexes.map((i) => i.name)

    expect(indexed('transactions')).toEqual(
      expect.arrayContaining(['goalId', 'billId', 'plannedId']),
    )
    expect(indexed('plannedTransactions')).toEqual(
      expect.arrayContaining(['goalId', 'incomeStreamId', 'billId']),
    )
    expect(indexed('plannedTransactions')).not.toContain('recurringId')
    expect(indexed('setAsides')).toEqual(
      expect.arrayContaining(['goalId', 'billId', 'walletId', 'plannedId']),
    )
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

    expect(upgraded.verno).toBe(4)
    expect(await upgraded.categories.count()).toBe(0)
    expect(await upgraded.transactions.count()).toBe(0)
    expect(await upgraded.syncState.count()).toBe(0)
    expect(await upgraded.outbox.count()).toBe(0)
    expect(await upgraded.appConfig.count()).toBe(1)
    expect(await upgraded.importBatches.count()).toBe(1)
    upgraded.close()
  })

  it('replaces the planning model when upgrading from version 3', async () => {
    const name = 'upgrade-from-v3'
    const v3 = new Dexie(name)
    v3.version(3).stores({
      appConfig: 'id',
      balanceNodes: 'id, parentId, dirty, deleted',
      categories: 'id, slug, parentId, dirty, deleted',
      incomeStreams: 'id, dirty, deleted',
      goals: 'id, dirty, deleted',
      goalAllocations: 'id, goalId, walletId, plannedId, dirty, deleted',
      transactions:
        'id, walletId, goalId, merchantId, transferId, categoryId, date, source, plannedId, dirty, deleted',
      budgets: 'id, dirty, deleted',
      recurrings: 'id, categoryId, dirty, deleted',
      plannedTransactions:
        'id, goalId, incomeStreamId, recurringId, categoryId, status, date, dirty, deleted',
      syncState: 'id',
      outbox: '++seq, [entity+id]',
      ledgerTotals: 'id, kind',
    })
    await v3.open()
    await v3.table('balanceNodes').put({ id: 'w1', parentId: null })
    await v3.table('goals').put({ id: 'g1', kind: 'onetime' })
    await v3.table('incomeStreams').put({ id: 's1', frequency: 'monthly' })
    await v3.table('goalAllocations').put({ id: 'a1', goalId: 'g1' })
    await v3.table('recurrings').put({ id: 'r1', categoryId: 'c1' })
    await v3.table('plannedTransactions').put({ id: 'p1', recurringId: 'r1' })
    await v3.table('budgets').put({ id: 'b1' })
    await v3.table('transactions').bulkPut([
      {
        id: 't-linked',
        type: 'spend',
        amount: 100,
        currency: 'SAR',
        walletId: 'w1',
        goalId: 'g1',
        plannedId: 'p1',
        deleted: 0,
      },
      {
        id: 't-plain',
        type: 'spend',
        amount: 50,
        currency: 'SAR',
        walletId: 'w1',
        goalId: null,
        plannedId: null,
        deleted: 0,
      },
    ])
    await v3.table('syncState').bulkPut([
      { id: 'u:transaction', since: 'a' },
      { id: 'u:planned', since: 'b' },
      { id: 'u:plannerInputs', since: 'c' },
    ])
    const outbox = v3.table('outbox')
    for (const entity of [
      'recurring',
      'allocation',
      'goal',
      'income',
      'planned',
      'node',
      'budget',
    ])
      await outbox.add({ entity, id: `${entity}-1`, op: 'create' })
    await outbox.add({
      entity: 'transaction',
      id: 't-linked',
      op: 'update',
      payload: { goal_id: 'g1', planned_id: 'p1', amount: 100 },
    })
    v3.close()

    const { AppDatabase } = await import('./db')
    const upgraded = new AppDatabase(name)
    await upgraded.open()

    expect(upgraded.verno).toBe(4)
    const names = upgraded.tables.map((t) => t.name)
    expect(names).not.toContain('recurrings')
    expect(names).not.toContain('goalAllocations')
    expect(await upgraded.goals.count()).toBe(0)
    expect(await upgraded.incomeStreams.count()).toBe(0)
    expect(await upgraded.plannedTransactions.count()).toBe(0)
    expect(await upgraded.bills.count()).toBe(0)
    expect(await upgraded.setAsides.count()).toBe(0)
    // Untouched: wallets, budgets and the ledger rows, minus their cleared links.
    expect(await upgraded.balanceNodes.count()).toBe(1)
    expect(await upgraded.budgets.count()).toBe(1)
    expect(await upgraded.transactions.get('t-linked')).toMatchObject({
      goalId: null,
      plannedId: null,
      amount: 100,
    })
    expect(await upgraded.transactions.get('t-plain')).toMatchObject({
      amount: 50,
    })
    const left = await upgraded.outbox.toArray()
    expect(left.map((e) => e.entity).sort()).toEqual([
      'budget',
      'node',
      'transaction',
    ])
    expect(left.find((e) => e.entity === 'transaction')?.payload).toEqual({
      goal_id: null,
      planned_id: null,
      amount: 100,
    })
    expect(
      (await upgraded.syncState.toArray()).map((w) => w.id).sort(),
    ).toEqual(['u:transaction'])
    upgraded.close()
  })
})
