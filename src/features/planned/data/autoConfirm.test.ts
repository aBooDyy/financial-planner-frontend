import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalPlanned } from '#/db/types'
import { defaultCategoryRows } from '#/features/categories/__fixtures__/categories'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import type { PaydayMode } from '#/features/wallets/api/types'
import {
  RATES,
  bill,
  goal,
  income,
  m,
  planned,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { usePaydayNoticeStore } from '#/features/planned/stores/paydayNotice'
import { autoPlan, autoSettlementId } from './autoConfirm'
import type { AutoContext } from './autoConfirm'
import { confirmPlanned, dismissFromReview } from './mutations'
import { runPlanner } from './runner'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const TODAY = '2026-10-01'

describe('autoPlan', () => {
  const rent = bill({ id: 'rent', autopay: true, walletId: 'main' })
  const gym = bill({ id: 'gym', autopay: false, walletId: 'main' })
  const salary = income({ id: 'salary', autolog: true, walletId: 'main' })
  const ctx = (over: Partial<AutoContext> = {}): AutoContext => ({
    today: TODAY,
    paydayMode: 'auto',
    bills: new Map([rent, gym].map((b) => [b.id, b])),
    goals: new Map([
      ['trip', goal({ id: 'trip' })],
      ['fund', goal({ id: 'fund', mustHave: true })],
    ]),
    streams: new Map([['salary', salary]]),
    depositWalletId: 'main',
    mainStreamId: 'salary',
    free: { main: m(1000), savings: m(5000) },
    walletCurrency: new Map([
      ['main', 'SAR'],
      ['savings', 'SAR'],
    ]),
    rates: RATES,
    isSettled: () => false,
    ...over,
  })
  const pay = (billId: string, date = TODAY) =>
    planned({
      id: `${billId}-pay`,
      origin: 'bill',
      role: 'payment',
      goalId: null,
      billId,
      date,
      occurrence: date,
    })
  const save = (
    id: string,
    goalId: string,
    walletId: string,
    amount: number,
    over: Partial<LocalPlanned> = {},
  ) =>
    planned({
      id,
      goalId,
      walletId,
      amount,
      date: TODAY,
      occurrence: TODAY,
      ...over,
    })

  it('pays auto-pay bills and logs auto-logged income once they are due', () => {
    const payday = planned({
      id: 'payday',
      origin: 'income',
      role: 'income',
      goalId: null,
      incomeStreamId: 'salary',
    })
    const plan = autoPlan(
      [pay('rent'), pay('gym'), pay('rent', '2026-10-02'), payday],
      ctx({ paydayMode: 'review' }),
    )
    expect(plan.payments).toEqual([{ id: 'rent-pay', walletId: 'main' }])
    expect(plan.income).toEqual([{ id: 'payday', walletId: 'main' }])
    expect(plan.setAsides).toEqual([])
  })

  it('sets aside deposit-wallet lines with free money, priority first, and sends the rest to review', () => {
    const plan = autoPlan(
      [
        save('trip-line', 'trip', 'main', m(600)),
        save('fund-line', 'fund', 'main', m(700)),
        save('elsewhere', 'trip', 'savings', m(100)),
      ],
      ctx(),
    )
    // The must-have goal goes first and takes 700 of the 1,000 free; 600 no longer fits.
    expect(plan.setAsides).toEqual([
      { id: 'fund-line', walletId: 'main', amount: m(700) },
    ])
    expect(plan.review.sort()).toEqual(['elsewhere', 'trip-line'])
  })

  it('leaves settled, pinned and already-reviewed lines alone, and does nothing in Review mode', () => {
    const rows = [
      save('pinned', 'trip', 'main', m(10), { pinned: true }),
      save('reviewed', 'trip', 'main', m(10), { review: true }),
      save('settled', 'trip', 'main', m(10)),
    ]
    expect(
      autoPlan(rows, ctx({ isSettled: (p) => p.id === 'settled' })),
    ).toEqual({ payments: [], income: [], setAsides: [], review: [] })
    expect(
      autoPlan(
        [save('x', 'trip', 'main', m(10))],
        ctx({ paydayMode: 'review' }),
      ).review,
    ).toEqual([])
  })

  it('waits for the payday’s pay to be confirmed before setting aside', () => {
    const payday = planned({
      id: 'payday',
      origin: 'income',
      role: 'income',
      goalId: null,
      incomeStreamId: 'salary',
    })
    const line = save('trip-line', 'trip', 'main', m(100))
    const manual = new Map([['salary', { ...salary, autolog: false }]])

    const waiting = autoPlan([payday, line], ctx({ streams: manual }))
    expect(waiting.setAsides).toEqual([])
    expect(waiting.review).toEqual([])

    // Confirmed (settled, or no longer open) — or logged in this same pass — it goes ahead.
    const confirmed = autoPlan(
      [payday, line],
      ctx({ streams: manual, isSettled: (p) => p.id === 'payday' }),
    )
    expect(confirmed.setAsides.map((a) => a.id)).toEqual(['trip-line'])
    expect(autoPlan([line], ctx({ streams: manual })).setAsides).toHaveLength(1)
    expect(autoPlan([payday, line], ctx()).setAsides).toHaveLength(1)
  })

  it('reviews everything without a deposit wallet', () => {
    const plan = autoPlan(
      [save('x', 'trip', 'main', m(10))],
      ctx({ depositWalletId: null }),
    )
    expect(plan.review).toEqual(['x'])
  })
})

describe('the planner’s auto pass', () => {
  const MAIN = wallet({ id: 'main', name: 'Main bank', amount: m(10000) })
  const SAVINGS = wallet({ id: 'savings', name: 'Savings' })
  /** Paid on the 1st into Main bank. */
  const SALARY = income({
    id: 'salary',
    amount: m(20000),
    day: 1,
    walletId: 'main',
  })

  const settle = (mode: PaydayMode) =>
    db.balanceSettings.put({
      id: SETTINGS_KEY,
      baseCurrency: 'SAR',
      paydayMode: mode,
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
    })

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
        db.balanceSettings,
        db.categories,
        db.outbox,
      ].map((t) => t.clear()),
    )
    await db.categories.bulkPut(defaultCategoryRows())
    await db.balanceNodes.bulkPut([MAIN, SAVINGS])
    await db.incomeStreams.put(SALARY)
    usePaydayNoticeStore.setState({ notice: null })
  })

  it('pays an auto-pay bill on its due date and releases what it had set aside', async () => {
    await settle('review')
    await db.bills.put(
      bill({
        id: 'rent',
        autopay: true,
        amount: m(3000),
        nextDue: '2026-10-05',
        walletId: 'main',
      }),
    )
    await db.setAsides.put(
      setAside({
        goalId: null,
        billId: 'rent',
        occurrence: '2026-10-05',
        walletId: 'main',
        amount: m(3000),
      }),
    )
    await runPlanner('u1', new Date(2026, 9, 2))
    expect(await db.transactions.count()).toBe(0)

    const summary = await runPlanner('u1', new Date(2026, 9, 6))
    expect(summary.auto.payments).toBe(1)
    const [tx] = await db.transactions.toArray()
    expect(tx).toMatchObject({ billId: 'rent', date: '2026-10-05' })
    expect((await db.setAsides.toArray()).filter(isLiveSetAside)).toEqual([])
    expect((await db.bills.get('rent'))?.nextDue).toBe('2026-11-05')
  })

  it('logs an auto-logged payday under a deterministic id', async () => {
    await settle('review')
    await db.incomeStreams.put({ ...SALARY, autolog: true })
    await runPlanner('u1', new Date(2026, 8, 20))
    const summary = await runPlanner('u1', new Date(2026, 9, 1))
    expect(summary.auto.income).toBe(1)
    const payday = (await db.plannedTransactions.toArray()).find(
      (p) => p.role === 'income' && p.occurrence === '2026-10-01',
    )
    expect(
      await db.transactions.get(autoSettlementId(payday?.id ?? '')),
    ).toMatchObject({ type: 'income', amount: m(20000) })
  })

  it('generates payday set-asides for review in Review mode', async () => {
    await settle('review')
    await db.goals.put(
      goal({ id: 'trip', amount: m(500), saveWalletId: 'main' }),
    )
    await runPlanner('u1', new Date(2026, 9, 1))
    const lines = await db.plannedTransactions
      .where('goalId')
      .equals('trip')
      .toArray()
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((p) => p.review)).toBe(true)
    expect(await db.setAsides.count()).toBe(0)
  })

  it('sets aside deposit-wallet lines in Automatic mode and sends the rest to review', async () => {
    await settle('auto')
    await db.incomeStreams.put({ ...SALARY, autolog: true })
    await db.goals.bulkPut([
      goal({ id: 'trip', amount: m(500), saveWalletId: 'main' }),
      goal({ id: 'car', amount: m(800), saveWalletId: 'savings', position: 1 }),
    ])
    await runPlanner('u1', new Date(2026, 9, 1))

    const live = (await db.setAsides.toArray()).filter(isLiveSetAside)
    expect(live.map((a) => [a.goalId, a.walletId, a.amount / 100])).toEqual([
      ['trip', 'main', 500],
    ])
    const car = (
      await db.plannedTransactions.where('goalId').equals('car').toArray()
    ).find((p) => p.date === '2026-10-01')
    expect(car).toMatchObject({ status: 'open', review: true })
    expect(usePaydayNoticeStore.getState().notice).toMatchObject({
      count: 1,
      total: m(500),
      review: 1,
    })

    // "Not now" keeps it out of the review and out of every later automatic pass.
    await dismissFromReview([car?.id ?? ''])
    await runPlanner('u1', new Date(2026, 9, 1))
    expect(await db.plannedTransactions.get(car?.id ?? '')).toMatchObject({
      status: 'open',
      review: false,
      pinned: true,
    })
  })

  it('holds Automatic set-asides until the payday’s pay is confirmed', async () => {
    await settle('auto')
    await db.goals.put(
      goal({ id: 'trip', amount: m(500), saveWalletId: 'main' }),
    )
    await runPlanner('u1', new Date(2026, 9, 1))
    expect(await db.setAsides.count()).toBe(0)
    const line = (
      await db.plannedTransactions.where('goalId').equals('trip').toArray()
    ).find((p) => p.date === '2026-10-01')
    expect(line).toMatchObject({ status: 'open', review: false })
    expect(usePaydayNoticeStore.getState().notice).toBeNull()

    const payday = (await db.plannedTransactions.toArray()).find(
      (p) => p.role === 'income' && p.occurrence === '2026-10-01',
    )
    await confirmPlanned(payday?.id ?? '', { walletId: 'main' })
    await runPlanner('u1', new Date(2026, 9, 1))
    const live = (await db.setAsides.toArray()).filter(isLiveSetAside)
    expect(live.map((a) => [a.goalId, a.amount / 100])).toEqual([['trip', 500]])
  })
})
