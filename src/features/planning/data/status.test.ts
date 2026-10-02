import { describe, expect, it } from 'vitest'
import {
  bill,
  goal,
  income,
  m,
  planned,
  setAside,
} from '#/features/planned/testing/fixtures'
import { scenario } from '#/features/planning/testing/state'
import type { Scenario } from '#/features/planning/testing/state'
import { billStatusOf, goalStatusOf } from './status'

const TODAY = '2026-10-02'
/** Paid on the 25th. */
const SALARY = income({ id: 'salary', amount: m(12000), day: 25 })
const RENT = bill({ id: 'rent', amount: m(3000), nextDue: '2026-11-01' })
const INSURANCE = bill({
  id: 'ins',
  amount: m(1200),
  frequency: 'annual',
  nextDue: '2027-03-01',
})

const billStatus = (b: typeof RENT, s: Omit<Scenario, 'today'> = {}) => {
  const { inputs, state, today } = scenario({
    income: [SALARY],
    bills: [b],
    today: TODAY,
    ...s,
  })
  return billStatusOf(b, inputs, state, today)
}

const held = (
  billId: string,
  occurrence: string,
  amount: number,
  walletId = 'w1',
) => setAside({ goalId: null, billId, occurrence, amount, walletId })

describe('bill status', () => {
  it('a monthly bill waits for its payday, then is covered', () => {
    expect(billStatus(RENT)).toMatchObject({
      state: 'saving_up',
      occurrence: '2026-11-01',
      setAside: 0,
      coveredOn: '2026-10-25',
      cycle: 'each_paycheck',
      perPaycheck: m(3000),
    })
    expect(
      billStatus(RENT, { setAsides: [held('rent', '2026-11-01', m(3000))] }),
    ).toMatchObject({ state: 'covered', setAside: m(3000) })
  })

  it('a yearly bill saves up: x of y, held per wallet', () => {
    const s = billStatus(INSURANCE, {
      setAsides: [
        held('ins', '2027-03-01', m(500), 'main'),
        held('ins', '2027-03-01', m(300), 'savings'),
      ],
    })
    expect(s).toMatchObject({
      state: 'saving_up',
      amount: m(1200),
      setAside: m(800),
      cycle: 'save_up',
      // 400 left over five paydays.
      perPaycheck: m(80),
    })
    expect(s.heldIn).toEqual([
      { walletId: 'main', externalLabel: null, amount: m(500) },
      { walletId: 'savings', externalLabel: null, amount: m(300) },
    ])
  })

  it('a bill due before the next payday is not set aside yet', () => {
    expect(
      billStatus(bill({ id: 'phone', amount: m(150), nextDue: '2026-10-12' })),
    ).toMatchObject({ state: 'not_set_aside', occurrence: '2026-10-12' })
  })

  it('is due once its date arrives, until the payment is confirmed', () => {
    const phone = bill({ id: 'phone', amount: m(150), nextDue: '2026-10-01' })
    expect(billStatus(phone)).toMatchObject({ state: 'due' })
  })

  it('is behind when a payday set-aside for it came and went unmade', () => {
    const s = billStatus(INSURANCE, {
      planned: [
        planned({
          origin: 'bill',
          goalId: null,
          billId: 'ins',
          role: 'set_aside',
          amount: m(200),
          occurrence: '2026-09-25',
        }),
      ],
    })
    expect(s).toMatchObject({ state: 'behind', behindBy: m(200) })
  })

  it('is short when pay cannot cover it by the due date', () => {
    const s = billStatus(
      bill({
        id: 'car',
        amount: m(30000),
        frequency: null,
        nextDue: '2026-11-30',
      }),
    )
    // Two paydays (Oct 25, Nov 25) of 12,000 before it is due.
    expect(s).toMatchObject({ state: 'short', shortBy: m(6000) })
  })

  it('is paid once a one-off is settled, and done once closed', () => {
    const once = bill({ id: 'once', frequency: null, nextDue: '2026-10-01' })
    expect(
      billStatus(once, {
        planned: [
          planned({
            origin: 'bill',
            role: 'payment',
            goalId: null,
            billId: 'once',
            occurrence: '2026-10-01',
            status: 'done',
          }),
        ],
      }).state,
    ).toBe('paid')
    expect(billStatus({ ...RENT, closedAt: '2026-09-30' }).state).toBe('done')
  })

  it('lists the next three open occurrences with what each holds', () => {
    const s = billStatus(RENT, {
      setAsides: [held('rent', '2026-12-01', m(1000))],
    })
    expect(s.next).toEqual([
      { occurrence: '2026-11-01', amount: m(3000), setAside: 0 },
      { occurrence: '2026-12-01', amount: m(3000), setAside: m(1000) },
      { occurrence: '2027-01-01', amount: m(3000), setAside: 0 },
    ])
  })
})

describe('goal status', () => {
  const goalStatus = (
    g: ReturnType<typeof goal>,
    s: Omit<Scenario, 'today'> = {},
  ) => {
    const { inputs, state, today } = scenario({
      income: [SALARY],
      goals: [g],
      today: TODAY,
      ...s,
    })
    return goalStatusOf(g, inputs, state, today)
  }
  const saved = (goalId: string, amount: number, walletId = 'w1') =>
    setAside({ goalId, amount, walletId })

  it('saves up toward a dated target and says when it gets there', () => {
    const umrah = goal({ id: 'umrah', target: m(13000), dueDate: '2027-03-01' })
    const s = goalStatus(umrah, { setAsides: [saved('umrah', m(1000))] })
    expect(s).toMatchObject({
      state: 'saving_up',
      ongoing: false,
      progress: m(1000),
      left: m(12000),
      perPaycheck: m(2400),
      finish: '2027-02-25',
      slipsTo: null,
    })
  })

  it('is ongoing without a target', () => {
    expect(goalStatus(goal({ id: 'fund', amount: m(300) }))).toMatchObject({
      state: 'saving_up',
      ongoing: true,
      finish: null,
      perPaycheck: m(300),
    })
  })

  it('is short when pay cannot reach the target by its date, and says roughly when it would', () => {
    const car = goal({ id: 'car', target: m(60000), dueDate: '2027-01-01' })
    const s = goalStatus(car)
    // Oct 25, Nov 25, Dec 25 at 12,000: 36,000 of 60,000, two more paydays to go.
    expect(s).toMatchObject({
      state: 'short',
      shortBy: m(24000),
      slipsTo: '2027-02-25',
    })
  })

  it('is behind when a planned set-aside came due and was not made', () => {
    const fund = goal({ id: 'fund', amount: m(300) })
    const s = goalStatus(fund, {
      planned: [
        planned({ goalId: 'fund', amount: m(300), occurrence: '2026-09-25' }),
      ],
    })
    expect(s).toMatchObject({ state: 'behind', behindBy: m(300) })
  })

  it('reads reached, paused and done', () => {
    const trip = goal({ id: 'trip', target: m(500), amount: m(100) })
    expect(goalStatus(trip, { setAsides: [saved('trip', m(500))] }).state).toBe(
      'reached',
    )
    expect(goalStatus({ ...trip, pausedAt: '2026-09-01' }).state).toBe('paused')
    expect(goalStatus({ ...trip, closedAt: '2026-09-01' }).state).toBe('done')
  })
})
