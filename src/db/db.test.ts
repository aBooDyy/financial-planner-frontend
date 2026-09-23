import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

/**
 * The schema is declared once, at `version(1)`, because no installed client exists to walk
 * forward. What is worth pinning is the shape that declaration produces — every table the
 * app reads, and the indexes the features actually query by.
 */

describe('the local database', () => {
  it('opens at a single version with every table the app reads', async () => {
    const { db } = await import('./db')
    await db.open()

    expect(db.verno).toBe(1)
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
      'merchantAliases',
      'merchants',
      'outbox',
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
      category: 'groceries',
      subcategory: null,
      walletId: 'w1',
      goalId: null,
      merchantId: null,
      date: '2026-05-01',
      note: null,
      source: 'csv:batch-1',
      transferId: null,
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
})
