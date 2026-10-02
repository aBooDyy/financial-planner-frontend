import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalPlanned } from '#/db/types'
import { defaultCategoryRows } from '#/features/categories/__fixtures__/categories'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import {
  bill,
  goal,
  m,
  planned,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import {
  closeRest,
  confirmPlanned,
  reopenPlanned,
  skipPlanned,
} from './mutations'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const MAIN = wallet({ id: 'main', name: 'Main bank' })
const SAVINGS = wallet({ id: 'savings', name: 'Savings' })
const INSURANCE = bill({
  id: 'ins',
  name: 'Car insurance',
  amount: m(1200),
  frequency: 'annual',
  nextDue: '2027-03-01',
  walletId: 'main',
})
const RENT = bill({
  id: 'rent',
  amount: m(3000),
  nextDue: '2026-10-01',
  walletId: 'main',
})

const payment = (
  b: typeof RENT,
  occurrence: string,
  over: Partial<LocalPlanned> = {},
) =>
  planned({
    id: `${b.id}:${occurrence}`,
    origin: 'bill',
    role: 'payment',
    goalId: null,
    billId: b.id,
    walletId: 'main',
    name: b.name,
    amount: b.amount,
    occurrence,
    ...over,
  })

const billSetAside = (
  billId: string,
  occurrence: string,
  walletId: string,
  amount: number,
  date: string,
) =>
  setAside({
    id: `${billId}:${walletId}:${date}`,
    goalId: null,
    billId,
    occurrence,
    walletId,
    amount,
    date,
  })

const live = async (billId: string) =>
  (await db.setAsides.where('billId').equals(billId).toArray())
    .filter(isLiveSetAside)
    .map((a) => [a.walletId, a.occurrence, a.amount / 100])

beforeEach(async () => {
  await Promise.all(
    [
      db.plannedTransactions,
      db.transactions,
      db.setAsides,
      db.goals,
      db.bills,
      db.balanceNodes,
      db.categories,
      db.outbox,
    ].map((t) => t.clear()),
  )
  await db.categories.bulkPut(defaultCategoryRows())
  await db.balanceNodes.bulkPut([MAIN, SAVINGS])
  await db.bills.bulkPut([INSURANCE, RENT])
})

describe('a bill payment releases set-asides only in the paying wallet', () => {
  beforeEach(async () => {
    await db.plannedTransactions.put(payment(INSURANCE, '2027-03-01'))
    await db.setAsides.bulkPut([
      billSetAside('ins', '2027-03-01', 'main', m(500), '2026-10-25'),
      billSetAside('ins', '2027-03-01', 'main', m(400), '2026-11-25'),
      billSetAside('ins', '2027-03-01', 'savings', m(300), '2026-10-25'),
    ])
  })

  it('releases the paying wallet’s rows oldest first and leaves the others', async () => {
    const result = await confirmPlanned('ins:2027-03-01', {
      walletId: 'main',
      date: '2027-03-01',
    })
    // Main held 900 of the 1,200: both released; the other 300 came from free money.
    expect(await live('ins')).toEqual([['savings', '2027-03-01', 300]])
    const released = (await db.setAsides.toArray()).filter(
      (a) => a.releasedAt !== null,
    )
    expect(released.map((a) => a.releasedById)).toEqual([
      result.settlementId,
      result.settlementId,
    ])
    expect(released.every((a) => a.releasedAt === '2027-03-01')).toBe(true)
  })

  it('splits the last row a partial payment ends inside', async () => {
    await confirmPlanned('ins:2027-03-01', {
      walletId: 'main',
      amount: m(700),
      date: '2027-03-01',
    })
    expect((await live('ins')).sort()).toEqual([
      ['main', '2027-03-01', 200],
      ['savings', '2027-03-01', 300],
    ])
    // A partial payment leaves the occurrence open, so next due stays.
    expect((await db.bills.get('ins'))?.nextDue).toBe('2027-03-01')
  })

  it('releases nothing from a wallet that held nothing for it', async () => {
    await db.balanceNodes.put(wallet({ id: 'cash', name: 'Cash' }))
    await confirmPlanned('ins:2027-03-01', { walletId: 'cash' })
    expect(await live('ins')).toHaveLength(3)
  })

  it('never touches another occurrence’s set-asides', async () => {
    await db.setAsides.put(
      billSetAside('ins', '2028-03-01', 'main', m(100), '2027-01-25'),
    )
    await confirmPlanned('ins:2027-03-01', { walletId: 'main' })
    expect(await live('ins')).toContainEqual(['main', '2028-03-01', 100])
  })
})

describe('next due follows the first occurrence not yet dealt with', () => {
  it('stays put when a later occurrence is paid ahead, then jumps past it', async () => {
    await db.plannedTransactions.bulkPut([
      payment(RENT, '2026-10-01'),
      payment(RENT, '2026-11-01'),
      payment(RENT, '2026-12-01'),
    ])
    await confirmPlanned('rent:2026-11-01', { walletId: 'main' })
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-10-01')

    await confirmPlanned('rent:2026-10-01', { walletId: 'main' })
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-12-01')
  })

  it('moves on for a skip or a close-the-rest, and back for a reopen', async () => {
    await db.plannedTransactions.bulkPut([
      payment(RENT, '2026-10-01'),
      payment(RENT, '2026-11-01'),
    ])
    await skipPlanned('rent:2026-10-01')
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-11-01')
    await confirmPlanned('rent:2026-11-01', {
      walletId: 'main',
      amount: m(1000),
    })
    await closeRest('rent:2026-11-01')
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-12-01')

    await reopenPlanned('rent:2026-10-01')
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-10-01')
  })

  it('rolls a skipped occurrence’s set-asides to the next open one', async () => {
    await db.plannedTransactions.bulkPut([
      payment(RENT, '2026-10-01'),
      payment(RENT, '2026-11-01', { status: 'done' }),
    ])
    await db.setAsides.put(
      billSetAside('rent', '2026-10-01', 'main', m(3000), '2026-09-25'),
    )
    await skipPlanned('rent:2026-10-01')
    expect(await live('rent')).toEqual([['main', '2026-12-01', 3000]])
  })
})

describe('a planned bill set-aside fills occurrences in order', () => {
  it('spills a payday’s set-aside across the occurrences it covers', async () => {
    const gym = bill({
      id: 'gym',
      amount: m(50),
      frequency: 'weekly',
      nextDue: '2026-10-27',
      walletId: 'main',
    })
    await db.bills.put(gym)
    await db.plannedTransactions.put(
      planned({
        id: 'gym-save',
        origin: 'bill',
        role: 'set_aside',
        goalId: null,
        billId: 'gym',
        amount: m(120),
        occurrence: '2026-10-25',
      }),
    )
    const result = await confirmPlanned('gym-save', { walletId: 'main' })
    expect(result.settlementIds).toHaveLength(3)
    expect(await live('gym')).toEqual([
      ['main', '2026-10-27', 50],
      ['main', '2026-11-03', 50],
      ['main', '2026-11-10', 20],
    ])
    expect(result.status).toBe('done')
  })

  it('writes the same rows once for a retried confirm with the same id', async () => {
    await db.plannedTransactions.put(
      planned({
        id: 'rent-save',
        origin: 'bill',
        role: 'set_aside',
        goalId: null,
        billId: 'rent',
        amount: m(3000),
        occurrence: '2026-09-25',
      }),
    )
    const id = '0190f0a0-0000-7000-8000-000000000001'
    await confirmPlanned('rent-save', { walletId: 'main', settlementId: id })
    expect((await db.setAsides.get(id))?.occurrence).toBe('2026-10-01')
  })
})

describe('a goal payment', () => {
  it('releases the goal’s set-asides in the paying wallet', async () => {
    await db.goals.put(goal({ id: 'trip', name: 'Trip' }))
    await db.setAsides.bulkPut([
      setAside({ id: 'a', goalId: 'trip', walletId: 'main', amount: m(800) }),
      setAside({
        id: 'b',
        goalId: 'trip',
        walletId: 'savings',
        amount: m(500),
      }),
    ])
    await db.plannedTransactions.put(
      planned({
        id: 'use',
        origin: 'manual',
        role: 'payment',
        goalId: 'trip',
        amount: m(600),
      }),
    )
    await confirmPlanned('use', { walletId: 'main' })
    const rows = (await db.setAsides.where('goalId').equals('trip').toArray())
      .filter(isLiveSetAside)
      .map((a) => [a.walletId, a.amount / 100])
      .sort()
    expect(rows).toEqual([
      ['main', 200],
      ['savings', 500],
    ])
  })
})
