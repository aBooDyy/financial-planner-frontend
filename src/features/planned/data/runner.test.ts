import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalPlanned } from '#/db/types'
import { closeBill } from '#/features/bills/data/actions'
import { updateBill } from '#/features/bills/data/mutations'
import { deleteGoal, updateGoal } from '#/features/goals/data/mutations'
import {
  bill,
  goal,
  income,
  m,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { useRecalcUndoStore } from '#/features/planned/stores/recalcUndo'
import { isoOf } from './dates'
import {
  addContribution,
  confirmPlanned,
  movePlanned,
  skipPlanned,
} from './mutations'
import { billOwner, goalOwner } from './owners'
import { loadPlannerInputs, recalcPlan, runPlanner } from './runner'
import { derivePlannerState } from './state'
import { buildGoalPlanView, comparePlan } from './views'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const JUN_12 = new Date(2026, 5, 12)
const SEP_24 = new Date(2026, 8, 24)
const USER = 'u1'

const MAIN = wallet({ id: 'w1', name: 'Main Checking' })
/** Paid on the 1st, so set-asides fall on the 1st. */
const SALARY = income({
  id: 'salary',
  amount: m(20000),
  day: 1,
  walletId: 'w1',
})
/** Due mid-February: the last payday before it is Feb 1. */
const UMRAH = goal({
  id: 'umrah',
  name: 'Umrah trip',
  target: m(13000),
  dueDate: '2027-02-15',
})
/** The SR 1,000 already saved toward Umrah before any plan existed. */
const BASELINE = setAside({
  id: 'baseline',
  goalId: 'umrah',
  amount: m(1000),
  date: '2026-05-01',
})
const withoutBaseline = () => db.setAsides.delete(BASELINE.id)

const setAsides = async (): Promise<LocalPlanned[]> =>
  (await db.plannedTransactions.where('goalId').equals('umrah').toArray())
    .filter((p) => p.role === 'set_aside')
    .sort((a, b) => a.occurrence.localeCompare(b.occurrence))
const byMonth = async (occurrence: string) =>
  (await setAsides()).find((p) => p.occurrence === occurrence) as LocalPlanned
const amounts = async () =>
  (await setAsides()).map((p) => [p.occurrence.slice(0, 7), p.amount / 100])

const planView = async (today: Date) => {
  const inputs = await loadPlannerInputs()
  const state = derivePlannerState(inputs, USER, today)
  return buildGoalPlanView({
    goal: inputs.goals.find((g) => g.id === 'umrah')!,
    planned: inputs.planned,
    desired: state.desired,
    txns: inputs.txns,
    setAsides: inputs.setAsides,
    progress: state.progress.umrah,
    nodes: [MAIN],
    index: state.index,
    rates: inputs.rates,
    today: isoOf(today),
  })
}

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
      db.outbox,
    ].map((t) => t.clear()),
  )
  await db.balanceNodes.put(MAIN)
  await db.incomeStreams.put(SALARY)
  await db.goals.put(UMRAH)
  await db.setAsides.put(BASELINE)
  useRecalcUndoStore.setState({ byOwner: {} })
})

describe('runPlanner — a goal’s first plan', () => {
  it('writes the set-asides as open rows and stores the plan on the goal', async () => {
    await runPlanner(USER, JUN_12)

    expect(await amounts()).toEqual([
      ['2026-07', 1500],
      ['2026-08', 1500],
      ['2026-09', 1500],
      ['2026-10', 1500],
      ['2026-11', 1500],
      ['2026-12', 1500],
      ['2027-01', 1500],
      ['2027-02', 1500],
    ])
    expect((await setAsides()).every((p) => p.status === 'open')).toBe(true)
    expect(await db.goals.get('umrah')).toMatchObject({
      plannedAt: '2026-06-12',
      planAmount: m(1500),
      planCount: 8,
      planStart: '2026-07-01',
    })
    // Paydays are planned too, into the stream's wallet.
    const paydays = await db.plannedTransactions
      .where('incomeStreamId')
      .equals('salary')
      .toArray()
    expect(paydays.map((p) => p.occurrence).sort()).toEqual([
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
    ])
    // Every row is queued for the server; a first plan offers no undo.
    expect(
      (await db.outbox.toArray()).filter((e) => e.entity === 'planned'),
    ).toHaveLength(11)
    expect(useRecalcUndoStore.getState().byOwner).toEqual({})
  })

  it('is a no-op when nothing changed', async () => {
    await runPlanner(USER, JUN_12)
    const again = await runPlanner(USER, JUN_12)
    expect(again).toMatchObject({ created: 0, updated: 0, removed: 0 })
  })

  it('leaves the stored plan alone when income changes', async () => {
    await runPlanner(USER, JUN_12)
    await db.incomeStreams.put({ ...SALARY, amount: m(9000) })
    await runPlanner(USER, JUN_12)
    expect(new Set((await amounts()).map(([, a]) => a))).toEqual(
      new Set([1500]),
    )
  })

  it('takes a deleted goal’s future unsettled rows with it and keeps its history', async () => {
    await runPlanner(USER, JUN_12)
    const jul = await byMonth('2026-07-01')
    await confirmPlanned(jul.id, { walletId: 'w1', date: '2026-07-01' })
    await deleteGoal('umrah')

    await runPlanner(USER, new Date(2026, 7, 15))

    const left = await setAsides()
    // July (confirmed) and August (already due) stay; September onward goes.
    expect(left.map((p) => p.occurrence)).toEqual(['2026-07-01', '2026-08-01'])
  })
})

describe('runPlanner — paydays follow the stream', () => {
  it('re-dates future open paydays when the stream becomes quarterly on a chosen payday', async () => {
    await runPlanner(USER, SEP_24)
    const paydays = async () =>
      (
        await db.plannedTransactions
          .where('incomeStreamId')
          .equals('salary')
          .toArray()
      )
        .filter((p) => p.deleted === 0)
        .map((p) => p.occurrence)
        .sort()
    expect(await paydays()).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])

    await db.incomeStreams.put({
      ...SALARY,
      frequency: 'quarterly',
      day: 5,
      anchorDate: '2026-11-05',
    })
    await runPlanner(USER, SEP_24)
    expect(await paydays()).toEqual(['2026-11-05'])

    await db.incomeStreams.put({
      ...SALARY,
      frequency: 'quarterly',
      day: 5,
      anchorDate: '2026-12-05',
    })
    await runPlanner(USER, SEP_24)
    expect(await paydays()).toEqual(['2026-12-05'])
  })
})

describe('runPlanner — rows whose origin is gone', () => {
  it('skips the deleted goal’s due rows once its set-asides went with it', async () => {
    await runPlanner(USER, JUN_12)
    const jul = await byMonth('2026-07-01')
    const aug = await byMonth('2026-08-01')
    await confirmPlanned(jul.id, {
      walletId: 'w1',
      amount: m(500),
      date: '2026-07-01',
    })
    await deleteGoal('umrah')

    const summary = await runPlanner(USER, new Date(2026, 7, 15))

    expect(summary.orphansResolved).toBe(2)
    // Deleting a goal deletes its set-asides, as the server does, so nothing settles Jul.
    expect(await db.setAsides.count()).toBe(0)
    expect((await db.plannedTransactions.get(jul.id))?.status).toBe('skipped')
    expect((await db.plannedTransactions.get(aug.id))?.status).toBe('skipped')
  })

  it('skips a deleted stream’s past payday and a hand-made set-aside of a deleted goal', async () => {
    await runPlanner(USER, JUN_12)
    await db.plannedTransactions.put({
      id: 'manual',
      origin: 'manual',
      role: 'set_aside',
      goalId: 'long-gone',
      incomeStreamId: null,
      billId: null,
      walletId: null,
      name: 'Old set-aside',
      amount: m(100),
      currency: 'SAR',
      categoryId: null,
      occurrence: '2026-06-20',
      date: '2026-06-20',
      status: 'open',
      pinned: false,
      review: false,
      note: null,
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
      deleted: 0,
    })
    await db.incomeStreams.clear()

    await runPlanner(USER, new Date(2026, 6, 1))

    const paydays = await db.plannedTransactions
      .where('incomeStreamId')
      .equals('salary')
      .toArray()
    // Jul 1 was due: skipped. Aug 1 / Sep 1 were future and unsettled: removed.
    expect(paydays.map((p) => [p.occurrence, p.status])).toEqual([
      ['2026-07-01', 'skipped'],
    ])
    expect((await db.plannedTransactions.get('manual'))?.status).toBe('skipped')
  })
})

describe('the design’s worked example (04 §4)', () => {
  /**
   * Umrah SR 13,000 by Feb 15, 2027, SR 1,000 saved, paid on the 1st. Plan Jun 12: SR 1,500 × 8,
   * Jul 1 → Feb 1.
   * Jul and Aug confirmed → SR 4,000. Sep 1 unconfirmed. Today Sep 24.
   */
  const setUp = async () => {
    await runPlanner(USER, JUN_12)
    for (const month of ['2026-07-01', '2026-08-01']) {
      await confirmPlanned((await byMonth(month)).id, {
        walletId: 'w1',
        date: month,
      })
    }
    await runPlanner(USER, SEP_24)
  }

  it('shows the stored plan, the live one and how far behind it is', async () => {
    await setUp()
    const view = await planView(SEP_24)

    expect(view.stored).toMatchObject({ amount: m(1500), count: 8 })
    // 9,000 left over Oct–Feb (5 set-asides) = 1,800/mo.
    expect(view.live).toMatchObject({
      amount: m(1800),
      count: 5,
      start: '2026-10-01',
    })
    expect(view.behind).toMatchObject({
      behind: m(1500),
      kind: 'behind',
      reason: 'unconfirmed',
    })
    expect(view.behind.oldestDue?.occurrence).toBe('2026-09-01')
    expect(view.progress).toMatchObject({
      saved: m(4000),
      awaiting: m(1500),
      target: m(13000),
    })
    // The background run never rewrote the stored plan.
    expect((await byMonth('2026-10-01')).amount).toBe(m(1500))
  })

  it('recalculates Oct–Feb to 1,800 and leaves the Sep 1 row due', async () => {
    await setUp()
    const before = await setAsides()

    const result = await recalcPlan(goalOwner('umrah'), USER, SEP_24)

    expect(await amounts()).toEqual([
      ['2026-07', 1500],
      ['2026-08', 1500],
      ['2026-09', 1500],
      ['2026-10', 1800],
      ['2026-11', 1800],
      ['2026-12', 1800],
      ['2027-01', 1800],
      ['2027-02', 1800],
    ])
    expect((await byMonth('2026-09-01')).status).toBe('open')
    expect(result?.header).toMatchObject({ amount: m(1800), count: 5 })
    expect(await db.goals.get('umrah')).toMatchObject({
      plannedAt: '2026-09-24',
      planAmount: m(1800),
      planCount: 5,
      planStart: '2026-10-01',
    })
    // Same rows, same ids — only amounts moved.
    expect((await setAsides()).map((p) => p.id)).toEqual(
      before.map((p) => p.id),
    )
    expect(useRecalcUndoStore.getState().byOwner['goal:umrah']).toBe(result)
  })

  it('undoes a recalculation exactly: same ids, same amounts, same stored plan', async () => {
    await setUp()
    const before = await setAsides()
    const goalBefore = await db.goals.get('umrah')

    const result = await recalcPlan(goalOwner('umrah'), USER, SEP_24)
    await result?.undo()

    const after = await setAsides()
    expect(after.map((p) => [p.id, p.amount, p.status])).toEqual(
      before.map((p) => [p.id, p.amount, p.status]),
    )
    expect(await db.goals.get('umrah')).toMatchObject({
      plannedAt: goalBefore?.plannedAt,
      planAmount: goalBefore?.planAmount,
      planCount: goalBefore?.planCount,
      planStart: goalBefore?.planStart,
    })
    expect(useRecalcUndoStore.getState().byOwner['goal:umrah']).toBeUndefined()
  })

  it('undo recreates rows the recalculation removed, under their old ids', async () => {
    await setUp()
    // Pull the deadline in: the new plan has fewer months, so some rows go.
    await db.goals.update('umrah', { dueDate: '2026-12-15' })
    const before = await setAsides()
    const result = await recalcPlan(goalOwner('umrah'), USER, SEP_24)
    expect((await setAsides()).length).toBeLessThan(before.length)

    await result?.undo()
    expect((await setAsides()).map((p) => [p.id, p.amount])).toEqual(
      before.map((p) => [p.id, p.amount]),
    )
  })

  it('counts a skipped month as behind', async () => {
    await setUp()
    await skipPlanned((await byMonth('2026-09-01')).id)
    const view = await planView(SEP_24)
    expect(view.behind).toMatchObject({ behind: m(1500), reason: 'skipped' })
  })

  it('offers a lower number when ahead of plan', async () => {
    await runPlanner(USER, JUN_12)
    await confirmPlanned((await byMonth('2026-07-01')).id, {
      walletId: 'w1',
      amount: m(3000),
      date: '2026-07-01',
    })
    const view = await planView(new Date(2026, 6, 10))
    expect(view.behind.kind).toBe('ahead')
    expect(view.live.amount).toBeLessThan(view.stored?.amount ?? 0)
  })
})

describe('a plan-changing edit', () => {
  it('rewrites the stored plan through the planner and offers an undo', async () => {
    await runPlanner(USER, JUN_12)
    await updateGoal('umrah', { target: m(16200) })

    await runPlanner(USER, JUN_12)

    // 15,200 left over the same 8 months = 1,900/mo.
    expect(new Set((await amounts()).map(([, a]) => a))).toEqual(
      new Set([1900]),
    )
    expect(useRecalcUndoStore.getState().byOwner['goal:umrah']).toBeDefined()
  })

  it('leaves the plan alone for a rename', async () => {
    await runPlanner(USER, JUN_12)
    await updateGoal('umrah', { name: 'Umrah 2027', color: '#3B82F6' })
    await runPlanner(USER, JUN_12)
    expect(useRecalcUndoStore.getState().byOwner['goal:umrah']).toBeUndefined()
  })
})

describe('recalculating around rows it may not rewrite', () => {
  /**
   * Browser-found: Umrah SR 13,000 by Feb 15, 2027, planned on Sep 24 as 2,600 × 5 (Oct–Feb).
   * A 1,000 contribution, then the Oct 1 set-aside moved to Sep 1 and confirmed in full:
   * saved 3,600, left 9,400. The engine spreads 9,400 over Oct–Feb, but Oct's id is taken by
   * the confirmed row, so only Nov–Feb can be written — they must carry the whole 9,400.
   */
  const setUp = async () => {
    await withoutBaseline()
    await runPlanner(USER, SEP_24)
    // Unlinked, as the scenario has it: on a real clock past Oct 1 the Oct row is due and
    // would otherwise take the contribution.
    await addContribution('umrah', {
      mode: 'now',
      amount: m(1000),
      walletId: 'w1',
      date: '2026-09-24',
      link: false,
    })
    const oct = await byMonth('2026-10-01')
    await movePlanned(oct.id, '2026-09-01')
    await confirmPlanned(oct.id, { walletId: 'w1', date: '2026-09-24' })
    return oct
  }
  const future = async () =>
    (await setAsides()).filter(
      (p) => p.occurrence > '2026-09-24' && p.status === 'open',
    )

  it('first plans 2,600 × 5 from Oct 1', async () => {
    await withoutBaseline()
    await runPlanner(USER, SEP_24)
    expect(await amounts()).toEqual([
      ['2026-10', 2600],
      ['2026-11', 2600],
      ['2026-12', 2600],
      ['2027-01', 2600],
      ['2027-02', 2600],
    ])
  })

  it('shows as "From today" exactly what a recalc would write', async () => {
    await setUp()
    const view = await planView(SEP_24)
    expect(view.progress.saved).toBe(m(3600))
    expect(view.live).toEqual({
      amount: m(2350),
      count: 4,
      start: '2026-11-01',
      end: '2027-02-01',
    })
  })

  it('writes the remaining 9,400 over Nov–Feb, and stored equals live afterwards', async () => {
    const oct = await setUp()

    const result = await recalcPlan(goalOwner('umrah'), USER, SEP_24)

    const rows = await future()
    expect(rows.map((p) => [p.occurrence, p.amount / 100])).toEqual([
      ['2026-11-01', 2350],
      ['2026-12-01', 2350],
      ['2027-01-01', 2350],
      ['2027-02-01', 2350],
    ])
    expect(rows.reduce((a, p) => a + p.amount, 0)).toBe(m(9400))
    // The confirmed, moved row is untouched.
    expect(await db.plannedTransactions.get(oct.id)).toMatchObject({
      status: 'done',
      date: '2026-09-01',
      amount: m(2600),
    })
    // The band reads the rows actually rewritten: Nov–Feb.
    expect(result?.header).toEqual({
      amount: m(2350),
      count: 4,
      start: '2026-11-01',
      end: '2027-02-01',
    })
    const view = await planView(SEP_24)
    expect(view.stored).toMatchObject({ amount: m(2350), count: 4 })
    expect(view.live.amount).toBe(m(2350))
    expect(view.isOffPlan).toBe(false)
  })

  it('counts a future row the user moved (still to be paid) toward what is left', async () => {
    await withoutBaseline()
    await runPlanner(USER, SEP_24)
    await movePlanned((await byMonth('2026-10-01')).id, '2026-10-20')

    await recalcPlan(goalOwner('umrah'), USER, SEP_24)

    const rows = await future()
    // Oct (moved, 2,600 still to pay) + Nov–Feb = 13,000: nothing needed to change.
    expect(rows.reduce((a, p) => a + p.amount, 0)).toBe(m(13000))
    expect(new Set(rows.map((p) => p.amount))).toEqual(new Set([m(2600)]))
    expect((await planView(SEP_24)).isOffPlan).toBe(false)
  })
})

describe('runPlanner — bills', () => {
  const RENT = bill({
    id: 'rent',
    name: 'Rent',
    amount: m(3000),
    nextDue: '2026-10-05',
    walletId: 'w1',
  })
  const rentRows = async (role: 'payment' | 'set_aside') =>
    (await db.plannedTransactions.where('billId').equals('rent').toArray())
      .filter((p) => p.role === role)
      .sort((a, b) => a.occurrence.localeCompare(b.occurrence))
      .map((p) => [p.occurrence, p.amount / 100])

  beforeEach(async () => {
    await db.goals.clear()
    await db.bills.put(RENT)
  })

  it('plans payments and the payday set-asides that cover them, and stores the plan', async () => {
    await runPlanner(USER, SEP_24)
    expect(await rentRows('payment')).toEqual([
      ['2026-10-05', 3000],
      ['2026-11-05', 3000],
      ['2026-12-05', 3000],
    ])
    expect(await rentRows('set_aside')).toEqual([
      ['2026-10-01', 3000],
      ['2026-11-01', 3000],
      ['2026-12-01', 3000],
    ])
    expect(await db.bills.get('rent')).toMatchObject({
      plannedAt: '2026-09-24',
      planAmount: m(3000),
      planCount: 3,
      planStart: '2026-10-01',
    })
    expect(useRecalcUndoStore.getState().byOwner).toEqual({})
  })

  it('rewrites the plan when the amount changes, with an undo', async () => {
    await runPlanner(USER, SEP_24)
    await updateBill('rent', { amount: m(3200) })
    await runPlanner(USER, SEP_24)

    expect(await rentRows('set_aside')).toEqual([
      ['2026-10-01', 3200],
      ['2026-11-01', 3200],
      ['2026-12-01', 3200],
    ])
    // Payments have no stored plan: they follow the bill.
    expect((await rentRows('payment')).map(([, a]) => a)).toEqual([
      3200, 3200, 3200,
    ])
    const undo = useRecalcUndoStore.getState().byOwner['bill:rent']
    expect(undo).toBeDefined()
    await undo.undo()
    expect((await rentRows('set_aside')).map(([, a]) => a)).toEqual([
      3000, 3000, 3000,
    ])
  })

  it('reads off its stored plan when the live one drifts, until recalculated', async () => {
    await runPlanner(USER, SEP_24)
    // Changed behind the planner's back (e.g. synced from another device mid-run).
    await db.bills.update('rent', { amount: m(3200) })
    const compare = async () => {
      const inputs = await loadPlannerInputs()
      const state = derivePlannerState(inputs, USER, SEP_24)
      return comparePlan({
        owner: billOwner('rent'),
        snapshot: inputs.bills[0],
        desired: state.desired,
        planned: inputs.planned,
        index: state.index,
        rates: inputs.rates,
        today: '2026-09-24',
      })
    }
    expect(await compare()).toMatchObject({
      stored: { amount: m(3000), count: 3 },
      live: { amount: m(3200) },
      offBy: m(200),
      isOffPlan: true,
    })
    await recalcPlan(billOwner('rent'), USER, SEP_24)
    expect((await compare()).isOffPlan).toBe(false)
  })

  it('leaves the plan alone for a rename', async () => {
    await runPlanner(USER, SEP_24)
    await updateBill('rent', { name: 'Flat', color: '#3B82F6' })
    await runPlanner(USER, SEP_24)
    expect(useRecalcUndoStore.getState().byOwner).toEqual({})
  })
})

describe('runPlanner — a bill whose schedule changed', () => {
  /** Yearly, half of it already set aside for March 1. */
  const INSURANCE = bill({
    id: 'insurance',
    name: 'Insurance',
    amount: m(1200),
    frequency: 'annual',
    nextDue: '2027-03-01',
    walletId: 'w1',
  })
  const HELD = setAside({
    id: 'held',
    goalId: null,
    billId: 'insurance',
    occurrence: '2027-03-01',
    amount: m(600),
    date: '2026-09-01',
  })
  const live = async () =>
    (await db.setAsides.where('billId').equals('insurance').toArray())
      .filter((a) => a.deleted === 0 && a.releasedAt === null)
      .map((a) => [a.occurrence, a.amount / 100])
  const plannedTotal = async () =>
    (await db.plannedTransactions.where('billId').equals('insurance').toArray())
      .filter((p) => p.role === 'set_aside' && p.status === 'open')
      .reduce((sum, p) => sum + p.amount / 100, 0)

  beforeEach(async () => {
    await db.goals.clear()
    await db.bills.put(INSURANCE)
    await db.setAsides.put(HELD)
  })

  it('carries what is set aside onto the moved due date, so it is not set aside twice', async () => {
    await runPlanner(USER, SEP_24)
    expect(await plannedTotal()).toBe(600)

    await updateBill('insurance', { nextDue: '2027-03-15' })
    await runPlanner(USER, SEP_24)

    expect(await live()).toEqual([['2027-03-15', 600]])
    expect(await plannedTotal()).toBe(600)
  })
})

describe('runPlanner — a one-off marked as paid', () => {
  it('does not leave its payment waiting in Needs confirming', async () => {
    await db.goals.clear()
    await db.bills.put(
      bill({
        id: 'service',
        name: 'Car service',
        amount: m(400),
        frequency: null,
        nextDue: '2026-09-20',
        walletId: 'w1',
      }),
    )
    await runPlanner(USER, SEP_24)
    const payment = async () =>
      (await db.plannedTransactions.where('billId').equals('service').toArray())
        .filter((p) => p.role === 'payment')
        .map((p) => p.status)
    expect(await payment()).toEqual(['open'])

    await closeBill('service', { closedAt: '2026-09-24' })
    await runPlanner(USER, SEP_24)

    expect(await payment()).toEqual(['skipped'])
  })
})

describe('runPlanner — a bill paid early', () => {
  it('drops the set-asides still planned for the occurrence it paid', async () => {
    await db.goals.clear()
    await db.bills.put(
      bill({
        id: 'tax',
        name: 'Tax',
        amount: m(1200),
        frequency: 'semi',
        nextDue: '2026-12-15',
        walletId: 'w1',
      }),
    )
    await runPlanner(USER, SEP_24)
    const open = async () =>
      (await db.plannedTransactions.where('billId').equals('tax').toArray())
        .filter((p) => p.role === 'set_aside' && p.status === 'open')
        .sort((a, b) => a.date.localeCompare(b.date))
    expect((await open()).map((p) => [p.date, p.amount / 100])).toEqual([
      ['2026-10-01', 400],
      ['2026-11-01', 400],
      ['2026-12-01', 400],
    ])

    const due = (
      await db.plannedTransactions.where('billId').equals('tax').toArray()
    ).find((p) => p.role === 'payment' && p.occurrence === '2026-12-15')
    await confirmPlanned(due?.id ?? '', { walletId: 'w1', date: '2026-09-24' })
    await runPlanner(USER, SEP_24)

    // December is paid: what is planned saves up for June alone, once.
    const total = (await open()).reduce((sum, p) => sum + p.amount, 0)
    expect(total).toBe(m(1200))
  })
})

describe('runPlanner — the pay periods change', () => {
  afterEach(() => db.balanceSettings.clear())
  const umrahDates = async () =>
    (await db.plannedTransactions.where('goalId').equals('umrah').toArray())
      .filter((p) => p.status === 'open' && p.role === 'set_aside')
      .map((p) => p.date)
      .sort()

  it('moves every plan onto the new paydays when the main paycheck moves', async () => {
    await runPlanner(USER, SEP_24)
    expect((await umrahDates())[0]).toBe('2026-10-01')

    await db.incomeStreams.put({ ...SALARY, day: 15 })
    await runPlanner(USER, SEP_24)

    const dates = await umrahDates()
    expect(dates.length).toBeGreaterThan(0)
    expect(dates.every((d) => d.endsWith('-15'))).toBe(true)
    // Quietly: nothing the user typed into the goal changed.
    expect(useRecalcUndoStore.getState().byOwner).toEqual({})
  })

  it('moves them onto calendar months when income starts to vary', async () => {
    await db.incomeStreams.put({ ...SALARY, day: 20 })
    await runPlanner(USER, SEP_24)
    expect((await umrahDates())[0]).toBe('2026-10-20')

    await db.balanceSettings.put({
      id: SETTINGS_KEY,
      baseCurrency: 'SAR',
      incomeVaries: true,
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
    })
    await runPlanner(USER, SEP_24)

    expect((await umrahDates()).every((d) => d.endsWith('-01'))).toBe(true)
  })
})

describe('runPlanner — without the auto pass', () => {
  it('plans but confirms nothing on its own', async () => {
    await db.goals.clear()
    await db.bills.put(
      bill({
        id: 'gym',
        autopay: true,
        amount: m(100),
        nextDue: '2026-09-20',
        walletId: 'w1',
      }),
    )
    const held = await runPlanner(USER, SEP_24, { auto: false })
    expect(held.auto.payments).toBe(0)
    expect(await db.transactions.count()).toBe(0)

    const run = await runPlanner(USER, SEP_24)
    expect(run.auto.payments).toBe(1)
  })
})
