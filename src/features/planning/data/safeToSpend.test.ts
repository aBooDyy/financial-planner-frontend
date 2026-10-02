import { describe, expect, it } from 'vitest'
import type { LocalPlanned } from '#/db/types'
import { DEFAULT_PLANNING_SETTINGS } from '#/features/wallets/api/types'
import type { PlanningSettings } from '#/features/wallets/api/types'
import {
  RATES,
  bill,
  income,
  m,
  planned,
  setAside,
} from '#/features/planned/testing/fixtures'
import { indexSettlements } from '#/features/planned/data/settle'
import { payCalendarOf } from './payPeriods'
import { safeToSpend } from './safeToSpend'
import type { SafeToSpendInput } from './safeToSpend'

const TODAY = '2026-10-02'
const SALARY = income({ id: 'salary', amount: m(12000), day: 25 })
const settings = (over: Partial<PlanningSettings> = {}) => ({
  ...DEFAULT_PLANNING_SETTINGS,
  ...over,
})
const CAL = payCalendarOf([SALARY], settings(), 'SAR', RATES, TODAY)

const INTERNET = bill({
  id: 'internet',
  name: 'Internet',
  amount: m(200),
  nextDue: '2026-10-05',
})
const PHONE = bill({
  id: 'phone',
  name: 'Phone',
  amount: m(150),
  nextDue: '2026-10-12',
})
const STREAMING = bill({
  id: 'streaming',
  name: 'Streaming',
  amount: m(300),
  nextDue: '2026-10-22',
})
const RENT = bill({
  id: 'rent',
  name: 'Rent',
  amount: m(3000),
  nextDue: '2026-11-01',
})
const BILLS = [INTERNET, PHONE, STREAMING, RENT]

const payment = (
  b: typeof RENT,
  date: string,
  over: Partial<LocalPlanned> = {},
) =>
  planned({
    id: `${b.id}:${date}`,
    origin: 'bill',
    role: 'payment',
    goalId: null,
    billId: b.id,
    name: b.name,
    amount: b.amount,
    occurrence: date,
    date,
    ...over,
  })

const ROWS: LocalPlanned[] = [
  payment(INTERNET, '2026-10-05'),
  payment(PHONE, '2026-10-12'),
  payment(STREAMING, '2026-10-22'),
  payment(RENT, '2026-11-01'),
  planned({
    id: 'payday',
    origin: 'income',
    role: 'income',
    goalId: null,
    incomeStreamId: 'salary',
    name: 'Salary',
    amount: m(12000),
    occurrence: '2026-10-25',
  }),
  planned({
    id: 'rent-save',
    origin: 'bill',
    role: 'set_aside',
    goalId: null,
    billId: 'rent',
    name: 'Rent set-aside',
    amount: m(3000),
    occurrence: '2026-10-25',
  }),
  planned({
    id: 'trip-save',
    goalId: 'trip',
    name: 'Trip set-aside',
    amount: m(800),
    occurrence: '2026-10-25',
  }),
]

/** Balance 5,400 with 1,900 set aside: 3,500 free. */
const HEADER = { balance: m(5400), setAside: m(1900), free: m(3500) }

const run = (over: Partial<SafeToSpendInput> = {}) =>
  safeToSpend({
    header: HEADER,
    planned: ROWS,
    index: new Map(),
    setAsides: [],
    bills: BILLS,
    settings: settings(),
    calendar: CAL,
    today: TODAY,
    base: 'SAR',
    rates: RATES,
    ...over,
  })

describe('safeToSpend', () => {
  it('until payday: free money less the bills before payday (03 §8’s example)', () => {
    const s = run()
    expect(s).toMatchObject({
      end: '2026-10-24',
      payday: '2026-10-25',
      balance: m(5400),
      setAside: m(1900),
      free: m(3500),
      safe: m(2850),
      shortBy: 0,
    })
    expect(s.bills.items.map((l) => [l.name, l.amount / 100])).toEqual([
      ['Internet', 200],
      ['Phone', 150],
      ['Streaming', 300],
    ])
    // Paydays and set-asides fall on the 25th: none before payday.
    expect(s.income.total).toBe(0)
    expect(s.setAsides.total).toBe(0)
  })

  it('counts only what is not already set aside for an occurrence', () => {
    const s = run({
      setAsides: [
        setAside({
          goalId: null,
          billId: 'internet',
          occurrence: '2026-10-05',
          amount: m(150),
        }),
      ],
    })
    expect(s.bills.items[0]).toMatchObject({ name: 'Internet', amount: m(50) })
    expect(s.safe).toBe(m(3500 - 50 - 150 - 300))
  })

  it('past payday: adds the income and takes the planned set-asides, never a bill twice', () => {
    const s = run({ settings: settings({ safeHorizon: 'end_of_month' }) })
    expect(s.end).toBe('2026-10-31')
    expect(s.payday).toBeNull()
    expect(s.income.total).toBe(m(12000))
    // Rent is due Nov 1, after the window: its set-aside counts; the trip's too.
    expect(s.setAsides.items.map((l) => l.name)).toEqual([
      'Rent set-aside',
      'Trip set-aside',
    ])
    expect(s.safe).toBe(m(3500 - 650 - 3800 + 12000))

    // Over the next 30 days rent's payment is inside the window instead: its set-aside drops out.
    const month = run({
      settings: settings({ safeHorizon: 'days', safeHorizonDays: 30 }),
    })
    expect(month.end).toBe('2026-11-01')
    expect(month.setAsides.items.map((l) => l.name)).toEqual(['Trip set-aside'])
    expect(month.bills.items.map((l) => l.name)).toContain('Rent')
  })

  it('looks 30 days ahead without a main paycheck', () => {
    const noIncome = payCalendarOf([], settings(), 'SAR', RATES, TODAY)
    const s = run({ calendar: noIncome })
    expect(s).toMatchObject({ end: '2026-11-01', payday: null })
  })

  it('reads short when the bills outrun free money, overdue ones included', () => {
    const s = run({
      header: { balance: m(500), setAside: m(0), free: m(500) },
      planned: [...ROWS, payment(PHONE, '2026-09-12')],
    })
    expect(s.safe).toBe(m(500 - 650 - 150))
    expect(s.shortBy).toBe(m(300))
  })

  it('counts what is left of a part-paid bill', () => {
    const paid = {
      id: 't',
      type: 'spend' as const,
      amount: m(100),
      currency: 'SAR',
      categoryId: null,
      walletId: 'w1',
      goalId: null,
      billId: 'streaming',
      merchantId: null,
      date: TODAY,
      note: null,
      source: null,
      transferId: null,
      plannedId: 'streaming:2026-10-22',
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0 as const,
      deleted: 0 as const,
    }
    const s = run({ index: indexSettlements([paid], []) })
    expect(s.bills.items.find((l) => l.name === 'Streaming')?.amount).toBe(
      m(200),
    )
  })
})
