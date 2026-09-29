import 'fake-indexeddb/auto'
import Dexie, { liveQuery } from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDatabase } from './db'
import type { LocalTransaction } from './types'
import { sameTotals, totalsOf } from '#/features/transactions/data/ledgerTotals'

/**
 * The running totals must always equal totals built from scratch over the ledger, whichever
 * way a row was written. Every case writes through the public table API and compares.
 */

let seq = 0
const tx = (over: Partial<LocalTransaction> = {}): LocalTransaction => ({
  id: `t${String(seq++).padStart(4, '0')}`,
  type: 'spend',
  amount: 100,
  currency: 'SAR',
  categoryId: 'cat-food',
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  date: '2026-06-12',
  note: null,
  source: null,
  transferId: null,
  plannedId: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

const opened: AppDatabase[] = []
const fresh = async (): Promise<AppDatabase> => {
  const db = new AppDatabase(`totals-${seq++}`)
  await db.open()
  opened.push(db)
  return db
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.delete()))
})

const expectInStep = async (db: AppDatabase) => {
  const stored = await db.ledgerTotals.toArray()
  const rebuilt = totalsOf(await db.transactions.toArray())
  expect(sameTotals(stored, rebuilt)).toBe(true)
  return stored
}

describe('the ledger totals', () => {
  it('follow put, bulkPut, update, soft delete and hard delete', async () => {
    const db = await fresh()
    const a = tx({ amount: 250, merchantId: 'm1' })
    await db.transactions.put(a)
    await db.transactions.bulkPut([
      tx({ currency: 'USD', amount: 40 }),
      tx({ type: 'income', amount: 900, categoryId: 'cat-salary' }),
      tx({ walletId: 'w2', merchantId: 'm1' }),
    ])
    await expectInStep(db)

    await db.transactions.put({ ...a, amount: 300, walletId: 'w2' })
    await expectInStep(db)
    await db.transactions.update(a.id, { categoryId: 'cat-fuel' })
    await expectInStep(db)
    await db.transactions.update(a.id, { deleted: 1 })
    await expectInStep(db)
    await db.transactions.delete(a.id)
    await db.transactions.bulkDelete(
      await db.transactions.limit(2).primaryKeys(),
    )
    const stored = await expectInStep(db)
    expect(stored.length).toBeGreaterThan(0)
  })

  it('hold up under writes racing inside one transaction', async () => {
    const db = await fresh()
    const rows = Array.from({ length: 40 }, (_, i) =>
      tx({ amount: i + 1, walletId: `w${i % 3}`, merchantId: 'm1' }),
    )
    await db.transaction('rw', db.transactions, async () => {
      await Promise.all(rows.map((r) => db.transactions.put(r)))
      await Promise.all(
        rows.slice(0, 10).map((r) => db.transactions.put({ ...r, deleted: 1 })),
      )
    })
    const stored = await expectInStep(db)
    expect(stored.find((t) => t.id === 'merchant:m1')?.count).toBe(30)
  })

  it('are written even when the caller’s transaction does not list them', async () => {
    const db = await fresh()
    await db.transaction('rw', db.transactions, db.outbox, async () => {
      await db.transactions.put(tx({ amount: 75 }))
      await db.outbox.add({
        entity: 'transaction',
        id: 'x',
        op: 'create',
        payload: {},
        createdAt: '',
      } as never)
    })
    const stored = await expectInStep(db)
    expect(stored.find((t) => t.kind === 'wallet')?.sum).toBe(-75)
  })

  it('roll back with the ledger when the transaction aborts', async () => {
    const db = await fresh()
    await db.transactions.put(tx({ amount: 10 }))
    await expect(
      db.transaction('rw', db.transactions, async () => {
        await db.transactions.put(tx({ amount: 20 }))
        throw new Error('abort')
      }),
    ).rejects.toThrow('abort')
    const stored = await expectInStep(db)
    expect(stored.find((t) => t.kind === 'wallet')?.sum).toBe(-10)
  })

  it('leave out the rows a bulk add failed on', async () => {
    const db = await fresh()
    const dupe = tx({ amount: 5 })
    await db.transactions.add(dupe)
    await expect(
      db.transactions.bulkAdd([tx({ amount: 7 }), { ...dupe, amount: 1_000 }]),
    ).rejects.toThrow()
    const stored = await expectInStep(db)
    expect(stored.find((t) => t.kind === 'wallet')?.sum).toBe(-12)
  })

  it('wake live queries on a ledger write that moves them, and only then', async () => {
    const db = await fresh()
    const row = tx({ amount: 30 })
    await db.transactions.put(row)
    const seen: number[] = []
    const sub = liveQuery(() =>
      db.ledgerTotals.where('kind').equals('wallet').toArray(),
    ).subscribe((rows) => seen.push(rows[0]?.sum ?? 0))
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
    await settle()

    await db.transactions.put({ ...row, note: 'lunch' })
    await settle()
    await db.transactions.put({ ...row, amount: 45 })
    await settle()
    sub.unsubscribe()

    expect(seen).toEqual([-30, -45])
  })

  it('empty when the ledger is cleared', async () => {
    const db = await fresh()
    await db.transactions.bulkPut([tx(), tx({ merchantId: 'm1' })])
    await db.transactions.clear()
    expect(await db.ledgerTotals.count()).toBe(0)
  })

  it('are built from the rows already there when upgrading from version 2', async () => {
    const name = `upgrade-from-v2-${seq++}`
    const rows = [tx({ amount: 60 }), tx({ amount: 15, merchantId: 'm1' })]
    const v2 = new Dexie(name)
    v2.version(2).stores({ transactions: 'id, walletId, goalId' })
    await v2.open()
    await v2.table('transactions').bulkPut(rows)
    v2.close()

    const upgraded = new AppDatabase(name)
    opened.push(upgraded)
    await upgraded.open()

    expect(
      sameTotals(await upgraded.ledgerTotals.toArray(), totalsOf(rows)),
    ).toBe(true)
  })
})

describe('checkLedgerTotals', () => {
  it('rebuilds totals that disagree with the ledger, and leaves agreeing ones alone', async () => {
    const { db } = await import('./db')
    const { checkLedgerTotals } = await import('./ledgerTotalsCheck')
    await db.transactions.bulkPut(
      Array.from({ length: 2_500 }, (_, i) => tx({ amount: i })),
    )
    expect(await checkLedgerTotals()).toBe(false)

    await db.ledgerTotals.put({
      id: 'wallet:w1:SAR',
      kind: 'wallet',
      ref: 'w1',
      currency: 'SAR',
      sum: 1,
      count: 1,
    })
    expect(await checkLedgerTotals()).toBe(true)
    await expectInStep(db)
    await db.transactions.clear()
  })
})
