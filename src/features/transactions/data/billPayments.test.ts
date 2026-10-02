import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { User } from '#/features/auth/api/types'
import {
  catId,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import {
  bill,
  m,
  planned,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { useSessionStore } from '#/stores/session'
import {
  removeTransaction,
  saveNewTransaction,
  saveTransactionEdit,
} from './billPayments'
import { bulkDeleteTransactions } from './mutations'
import type { TransactionDraft } from './mutations'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const MAIN = wallet({ id: 'main', name: 'Main bank' })
const SAVINGS = wallet({ id: 'savings', name: 'Savings' })
const RENT = bill({
  id: 'rent',
  name: 'Rent',
  amount: m(3000),
  nextDue: '2026-10-05',
  walletId: 'main',
})
const OCT_ROW = planned({
  id: 'rent-oct',
  origin: 'bill',
  role: 'payment',
  goalId: null,
  billId: 'rent',
  walletId: 'main',
  name: 'Rent',
  amount: m(3000),
  occurrence: '2026-10-05',
})
const heldFor = (walletId: string, amount: number) =>
  setAside({
    goalId: null,
    billId: 'rent',
    occurrence: '2026-10-05',
    walletId,
    amount,
  })

const spend = (over: Partial<TransactionDraft> = {}): TransactionDraft => ({
  type: 'spend',
  amount: m(3000),
  currency: 'SAR',
  categoryId: catId('housing'),
  walletId: 'main',
  goalId: null,
  billId: 'rent',
  plannedId: 'rent-oct',
  merchantId: null,
  date: '2026-10-04',
  note: null,
  ...over,
})

const liveRent = async () =>
  (await db.setAsides.where('billId').equals('rent').toArray())
    .filter(isLiveSetAside)
    .map((a) => [a.walletId, a.amount / 100])
const nextDue = async () => (await db.bills.get('rent'))?.nextDue

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.categories.bulkPut(defaultCategoryRows())
  await db.balanceNodes.bulkPut([MAIN, SAVINGS])
  await db.bills.put(RENT)
  await db.plannedTransactions.put(OCT_ROW)
  await db.setAsides.bulkPut([
    heldFor('main', m(2000)),
    heldFor('savings', m(1000)),
  ])
  useSessionStore.setState({
    status: 'authenticated',
    user: { id: 'u1' } as User,
    verified: true,
  })
})

describe('a bill payment saved from the dialog or QuickAdd', () => {
  it('releases only the paying wallet’s set-aside, moves next due on and asks about the rest', async () => {
    const prompt = await saveNewTransaction(spend())

    const [tx] = await db.transactions.toArray()
    expect(tx).toMatchObject({ billId: 'rent', plannedId: 'rent-oct' })
    expect((await db.plannedTransactions.get('rent-oct'))?.status).toBe('done')
    expect(await nextDue()).toBe('2026-11-05')
    expect(await liveRent()).toEqual([['savings', 1000]])
    const released = (await db.setAsides.toArray()).find(
      (a) => a.walletId === 'main',
    )
    expect(released?.releasedById).toBe(tx.id)

    expect(prompt).toMatchObject({ payingWalletId: 'main', date: '2026-10-04' })
    expect(prompt?.report.lines).toEqual([
      expect.objectContaining({ walletId: 'savings', amount: m(1000) }),
    ])
  })

  it('pays a picked bill’s first open occurrence when nothing was matched', async () => {
    await db.plannedTransactions.clear()
    await saveNewTransaction(spend({ plannedId: null }))

    const [tx] = await db.transactions.toArray()
    const row = await db.plannedTransactions.get(tx.plannedId ?? '')
    expect(row).toMatchObject({
      billId: 'rent',
      occurrence: '2026-10-05',
      status: 'done',
    })
    expect(await nextDue()).toBe('2026-11-05')
  })

  it('asks nothing about other wallets after a part payment', async () => {
    const prompt = await saveNewTransaction(spend({ amount: m(2500) }))
    expect(prompt).toBeNull()
    expect((await db.plannedTransactions.get('rent-oct'))?.status).toBe('open')
    expect(await liveRent()).toEqual([['savings', 1000]])
  })

  it('asks nothing when the paying wallet held it all', async () => {
    await db.setAsides.clear()
    await db.setAsides.put(heldFor('main', m(3000)))
    expect(await saveNewTransaction(spend())).toBeNull()
    expect(await liveRent()).toEqual([])
  })

  it('leaves a spend that pays no bill as it is', async () => {
    const prompt = await saveNewTransaction(
      spend({ billId: null, plannedId: null }),
    )
    expect(prompt).toBeNull()
    expect(await nextDue()).toBe('2026-10-05')
    expect(await liveRent()).toHaveLength(2)
  })

  it('still saves a payment for a bill that was ended, without paying it', async () => {
    await db.bills.put({ ...RENT, closedAt: '2026-09-30T00:00:00Z' })
    expect(await saveNewTransaction(spend())).toBeNull()
    expect(await db.transactions.count()).toBe(1)
    expect(await liveRent()).toHaveLength(2)
  })

  it('pays the bill when an edit links an existing spend to it', async () => {
    await saveNewTransaction(spend({ billId: null, plannedId: null }))
    const [tx] = await db.transactions.toArray()

    const prompt = await saveTransactionEdit(tx.id, spend())
    expect(await db.transactions.get(tx.id)).toMatchObject({
      billId: 'rent',
      plannedId: 'rent-oct',
    })
    expect(await nextDue()).toBe('2026-11-05')
    expect(await liveRent()).toEqual([['savings', 1000]])
    expect(prompt?.report.lines).toHaveLength(1)
  })

  it('does not pay again when an edit keeps the link', async () => {
    await saveNewTransaction(spend())
    const [tx] = await db.transactions.toArray()
    const prompt = await saveTransactionEdit(
      tx.id,
      spend({ note: 'October rent' }),
    )
    expect(prompt).toBeNull()
    expect(await liveRent()).toEqual([['savings', 1000]])
    expect(await nextDue()).toBe('2026-11-05')
  })

  it('steps next due back when the payment is unlinked or deleted', async () => {
    await saveNewTransaction(spend())
    const [tx] = await db.transactions.toArray()

    await saveTransactionEdit(tx.id, spend({ billId: null, plannedId: null }))
    expect(await nextDue()).toBe('2026-10-05')

    await saveTransactionEdit(tx.id, spend())
    expect(await nextDue()).toBe('2026-11-05')
    await removeTransaction(tx.id)
    expect(await nextDue()).toBe('2026-10-05')
  })
})

describe('undoing a bill payment gives back what it released', () => {
  const paid = async (over: Partial<TransactionDraft> = {}) => {
    await saveNewTransaction(spend(over))
    const [tx] = await db.transactions.toArray()
    return tx.id
  }
  const liveRows = async () =>
    (await db.setAsides.where('billId').equals('rent').toArray())
      .filter(isLiveSetAside)
      .map((a) => [a.walletId, a.occurrence, a.amount / 100])
      .sort()

  it('restores the paying wallet’s set-aside when the payment is deleted', async () => {
    const id = await paid()
    await removeTransaction(id)
    expect(await liveRows()).toEqual([
      ['main', '2026-10-05', 2000],
      ['savings', '2026-10-05', 1000],
    ])
    expect(await nextDue()).toBe('2026-10-05')
  })

  it('restores it when the payment is unlinked from the bill', async () => {
    const id = await paid()
    await saveTransactionEdit(id, spend({ billId: null, plannedId: null }))
    expect(await liveRows()).toEqual([
      ['main', '2026-10-05', 2000],
      ['savings', '2026-10-05', 1000],
    ])
  })

  it('releases again for a new amount, however many times it is edited', async () => {
    const id = await paid()
    await saveTransactionEdit(id, spend({ amount: m(1500) }))
    expect(await liveRows()).toEqual([
      ['main', '2026-10-05', 500],
      ['savings', '2026-10-05', 1000],
    ])
    expect(await nextDue()).toBe('2026-10-05')

    await saveTransactionEdit(id, spend({ amount: m(1000) }))
    expect((await liveRows()).filter(([w]) => w === 'main')).toEqual([
      ['main', '2026-10-05', 1000],
    ])
  })

  it('releases in the new wallet when the payment moves to another one', async () => {
    const id = await paid()
    await saveTransactionEdit(id, spend({ walletId: 'savings' }))
    expect(await liveRows()).toEqual([['main', '2026-10-05', 2000]])
    expect(await nextDue()).toBe('2026-11-05')
  })

  it('restores and steps next due back on a bulk delete', async () => {
    const id = await paid()
    await bulkDeleteTransactions([id])
    expect(await liveRows()).toEqual([
      ['main', '2026-10-05', 2000],
      ['savings', '2026-10-05', 1000],
    ])
    expect(await nextDue()).toBe('2026-10-05')
  })
})
