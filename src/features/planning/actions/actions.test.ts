import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { User } from '#/features/auth/api/types'
import { reopenBill, closeBill } from '#/features/bills/data/actions'
import {
  catId,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import { closeGoal } from '#/features/goals/data/actions'
import { billOwner, goalOwner } from '#/features/planned/data/owners'
import { takePlanRecalcRequests } from '#/features/planned/data/recalcRequests'
import { runPlanner } from '#/features/planned/data/runner'
import {
  bill,
  goal,
  income,
  m,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { useSessionStore } from '#/stores/session'
import { addMoney } from './addMoney'
import { MoneyActionError } from './errors'
import { markGoalSpent, spendFromGoal } from './goalMoney'
import { resolveLeftover } from './leftover'
import { payBill } from './payBill'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const SEP_24 = new Date(2026, 8, 24)
const MAIN = wallet({ id: 'main', name: 'Main bank' })
const SAVINGS = wallet({ id: 'savings', name: 'Savings' })
/** Paid on the 1st into Main bank. */
const SALARY = income({
  id: 'salary',
  amount: m(20000),
  day: 1,
  walletId: 'main',
})
const RENT = bill({
  id: 'rent',
  name: 'Rent',
  amount: m(3000),
  nextDue: '2026-10-05',
  walletId: 'main',
})
const INSURANCE = bill({
  id: 'ins',
  name: 'Car insurance',
  amount: m(1200),
  frequency: 'annual',
  nextDue: '2027-03-01',
  walletId: 'main',
})

const liveOf = async (billId: string) =>
  (await db.setAsides.where('billId').equals(billId).toArray())
    .filter(isLiveSetAside)
    .map((a) => [a.walletId, a.occurrence, a.amount / 100])
    .sort()

beforeEach(async () => {
  await Promise.all(
    [
      db.plannedTransactions,
      db.transactions,
      db.setAsides,
      db.goals,
      db.bills,
      db.incomeStreams,
      db.balanceNodes,
      db.categories,
      db.balanceSettings,
      db.outbox,
    ].map((t) => t.clear()),
  )
  await db.categories.bulkPut(defaultCategoryRows())
  await db.balanceNodes.bulkPut([MAIN, SAVINGS])
  await db.incomeStreams.put(SALARY)
  await db.bills.bulkPut([RENT, INSURANCE])
  useSessionStore.setState({
    status: 'authenticated',
    user: { id: 'u1' } as User,
    verified: true,
  })
  takePlanRecalcRequests()
})

describe('Add money', () => {
  it('fills the current occurrence, then spills into the next ones', async () => {
    await addMoney(billOwner('rent'), [{ walletId: 'main', amount: m(4000) }], {
      date: '2026-09-24',
    })
    expect(await liveOf('rent')).toEqual([
      ['main', '2026-10-05', 3000],
      ['main', '2026-11-05', 1000],
    ])
    expect(takePlanRecalcRequests()).toEqual([
      { owner: billOwner('rent'), quiet: true },
    ])
  })

  it('splits across wallets and outside, one set-aside per wallet and occurrence', async () => {
    await addMoney(
      billOwner('rent'),
      [
        { walletId: 'main', amount: m(2000) },
        { walletId: 'savings', amount: m(1500) },
        { externalLabel: 'Cash with mom', amount: m(100) },
      ],
      { date: '2026-09-24' },
    )
    const rows = await db.setAsides.where('billId').equals('rent').toArray()
    expect(
      rows
        .map((a) => [
          a.walletId ?? a.externalLabel,
          a.occurrence,
          a.amount / 100,
        ])
        .sort(),
    ).toEqual([
      ['Cash with mom', '2026-11-05', 100],
      ['main', '2026-10-05', 2000],
      ['savings', '2026-10-05', 1000],
      ['savings', '2026-11-05', 500],
    ])
  })

  it('lowers the set-asides later paydays plan once the planner runs', async () => {
    await runPlanner('u1', SEP_24)
    const planned = async () =>
      (await db.plannedTransactions.where('billId').equals('ins').toArray())
        .filter((p) => p.role === 'set_aside' && p.status === 'open')
        .map((p) => p.amount / 100)
    // Oct 1 … Mar 1: six paydays for 1,200.
    expect(await planned()).toEqual([200, 200, 200, 200, 200, 200])

    await addMoney(billOwner('ins'), [{ walletId: 'main', amount: m(600) }], {
      date: '2026-09-24',
    })
    await runPlanner('u1', SEP_24)
    expect(await planned()).toEqual([100, 100, 100, 100, 100, 100])
  })

  it('settles the oldest planned set-aside waiting to be confirmed first', async () => {
    await db.goals.put(goal({ id: 'trip', amount: m(500) }))
    await runPlanner('u1', new Date(2026, 9, 1))
    const due = (
      await db.plannedTransactions.where('goalId').equals('trip').toArray()
    ).find((p) => p.date === '2026-10-01')
    expect(due?.status).toBe('open')

    await addMoney(goalOwner('trip'), [{ walletId: 'main', amount: m(500) }], {
      date: '2026-10-01',
    })
    expect((await db.plannedTransactions.get(due?.id ?? ''))?.status).toBe(
      'done',
    )
  })

  it('refuses a closed bill and a non-positive amount', async () => {
    await expect(
      addMoney(billOwner('rent'), [{ walletId: 'main', amount: 0 }]),
    ).rejects.toMatchObject({ code: 'bad_amount' })
    await closeBill('rent', { closedAt: '2026-09-24' })
    await expect(
      addMoney(billOwner('rent'), [{ walletId: 'main', amount: m(10) }]),
    ).rejects.toBeInstanceOf(MoneyActionError)
  })
})

describe('Pay now', () => {
  it('pays the next occurrence in full and moves next due on', async () => {
    const result = await payBill('rent', { date: '2026-10-04' })
    expect(result).toMatchObject({ occurrence: '2026-10-05', status: 'done' })
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-11-05')
    const tx = await db.transactions.get(result.transactionId)
    expect(tx).toMatchObject({
      billId: 'rent',
      amount: m(3000),
      date: '2026-10-04',
    })
  })

  it('prepays a later occurrence, beyond what the planner generated, without skipping the next', async () => {
    const result = await payBill('rent', { occurrence: '2027-06-05' })
    expect(result.status).toBe('done')
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-10-05')

    // Paying several in a row walks next due past every one settled.
    await payBill('rent')
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-11-05')
  })

  it('pays part of an occurrence and leaves it open', async () => {
    const result = await payBill('rent', { amount: m(1000) })
    expect(result.status).toBe('open')
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-10-05')
  })

  it('reports what other wallets still hold, and each leftover answer acts on it', async () => {
    const holdings = () =>
      db.setAsides.bulkPut([
        setAside({
          goalId: null,
          billId: 'ins',
          occurrence: '2027-03-01',
          walletId: 'main',
          amount: m(900),
        }),
        setAside({
          goalId: null,
          billId: 'ins',
          occurrence: '2027-03-01',
          walletId: 'savings',
          amount: m(300),
        }),
      ])
    await holdings()
    const { leftover } = await payBill('ins', { date: '2027-03-01' })
    expect(leftover.lines).toEqual([
      expect.objectContaining({ walletId: 'savings', amount: m(300) }),
    ])
    expect(leftover).toMatchObject({
      canKeep: true,
      nextOccurrence: '2028-03-01',
    })

    await resolveLeftover(leftover, 'keep', { payingWalletId: 'main' })
    expect(await liveOf('ins')).toEqual([['savings', '2028-03-01', 300]])
  })

  it('moves a leftover to the paying wallet with a transfer, or frees it', async () => {
    await db.setAsides.put(
      setAside({
        goalId: null,
        billId: 'ins',
        occurrence: '2027-03-01',
        walletId: 'savings',
        amount: m(300),
      }),
    )
    const { leftover } = await payBill('ins', { walletId: 'main' })
    await resolveLeftover(leftover, 'move', {
      payingWalletId: 'main',
      date: '2027-03-01',
    })
    expect(await liveOf('ins')).toEqual([])
    const legs = (await db.transactions.toArray()).filter((t) => t.transferId)
    expect(
      legs.map((t) => [t.type, t.walletId, t.amount / 100]).sort(),
    ).toEqual([
      ['transfer_in', 'main', 300],
      ['transfer_out', 'savings', 300],
    ])
  })
})

describe('the leftover’s free answer', () => {
  it('releases what other wallets held, where it is', async () => {
    await db.setAsides.put(
      setAside({
        goalId: null,
        billId: 'ins',
        occurrence: '2027-03-01',
        walletId: 'savings',
        amount: m(300),
      }),
    )
    const { leftover } = await payBill('ins', { walletId: 'main' })
    await resolveLeftover(leftover, 'free', { payingWalletId: 'main' })
    expect(await liveOf('ins')).toEqual([])
    expect((await db.transactions.toArray()).some((t) => t.transferId)).toBe(
      false,
    )
  })
})

describe('Use it and I spent it', () => {
  const TRIP = goal({ id: 'trip', name: 'Trip', target: m(5000) })

  beforeEach(async () => {
    await db.goals.put(TRIP)
    await db.setAsides.bulkPut([
      setAside({ id: 'm', goalId: 'trip', walletId: 'main', amount: m(800) }),
      setAside({
        id: 's',
        goalId: 'trip',
        walletId: 'savings',
        amount: m(400),
      }),
    ])
  })

  it('asks for a category the first time and remembers it', async () => {
    await expect(
      spendFromGoal('trip', { amount: m(100), walletId: 'main' }),
    ).rejects.toMatchObject({ code: 'category_required' })
    await spendFromGoal('trip', {
      amount: m(300),
      walletId: 'main',
      categoryId: catId('travel'),
    })
    expect((await db.goals.get('trip'))?.useCategoryId).toBe(catId('travel'))
    // The paying wallet's set-aside went down; the other wallet's did not.
    const live = (await db.setAsides.toArray())
      .filter(isLiveSetAside)
      .map((a) => [a.walletId, a.amount / 100])
      .sort()
    expect(live).toEqual([
      ['main', 500],
      ['savings', 400],
    ])
  })

  it('spends everything set aside and closes the goal, freeing the rest', async () => {
    await db.goals.update('trip', { useCategoryId: catId('travel') })
    const id = await markGoalSpent('trip', {
      walletId: 'main',
      date: '2026-09-24',
    })
    expect((await db.transactions.get(id ?? ''))?.amount).toBe(m(1200))
    expect((await db.goals.get('trip'))?.closedAt).toBe('2026-09-24')
    expect((await db.setAsides.toArray()).filter(isLiveSetAside)).toEqual([])
  })
})

describe('closing and reopening', () => {
  it('rewrites the plan from today when a bill is reopened', async () => {
    await db.balanceSettings.put({
      id: SETTINGS_KEY,
      baseCurrency: 'SAR',
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
    })
    await runPlanner('u1', SEP_24)
    const open = async () =>
      (await db.plannedTransactions.where('billId').equals('rent').toArray())
        .filter((p) => p.role === 'set_aside')
        .map((p) => p.occurrence)
        .sort()
    expect(await open()).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])

    await closeBill('rent', { closedAt: '2026-09-24' })
    expect(await open()).toEqual([])

    await reopenBill('rent')
    expect(takePlanRecalcRequests()).toEqual([
      { owner: billOwner('rent'), quiet: true },
    ])
    await runPlanner('u1', SEP_24)
    expect(await open()).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
  })

  it('frees what a goal held when it is marked done under target', async () => {
    await db.goals.put(goal({ id: 'car', target: m(9000) }))
    await db.setAsides.put(
      setAside({ goalId: 'car', walletId: 'main', amount: m(4000) }),
    )
    await closeGoal('car', { closedAt: '2026-09-24' })
    expect((await db.setAsides.toArray()).filter(isLiveSetAside)).toEqual([])
  })
})
