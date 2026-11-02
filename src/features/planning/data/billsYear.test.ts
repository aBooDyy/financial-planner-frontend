import { describe, expect, it } from 'vitest'
import type {
  LocalBill,
  LocalIncomeStream,
  LocalPlanned,
  LocalTransaction,
} from '#/db/types'
import { bill, income, m, RATES, tx } from '#/features/planned/testing/fixtures'
import type { PlannerInputs } from '#/features/planned/data/state'
import { plannedScenario } from '#/features/planning/testing/state'
import { buildBillsYear } from './billsYear'

const TODAY = '2026-11-15'

const inputsOf = (over: {
  bills?: LocalBill[]
  income?: LocalIncomeStream[]
  txns?: LocalTransaction[]
  planned?: LocalPlanned[]
}): PlannerInputs => ({
  goals: [],
  income: over.income ?? [],
  bills: over.bills ?? [],
  planned: over.planned ?? [],
  txns: over.txns ?? [],
  setAsides: [],
  settings: plannedScenario({ today: TODAY }).inputs.settings,
  base: 'SAR',
  rates: RATES,
})

const year = (over: Parameters<typeof inputsOf>[0]) =>
  buildBillsYear(inputsOf(over), TODAY)

const amountIn = (y: ReturnType<typeof year>, month: string) =>
  y.months.find((x) => x.month === month)?.amount

describe('buildBillsYear', () => {
  it('covers twelve calendar months from this one', () => {
    const y = year({})
    expect(y.months).toHaveLength(12)
    expect(y.months[0].month).toBe('2026-11')
    expect(y.months[11].month).toBe('2027-10')
  })

  it('totals a monthly bill and an annual one, and spreads them over the months', () => {
    const y = year({
      bills: [
        bill({ id: 'rent', amount: m(3000), nextDue: '2026-11-20' }),
        bill({
          id: 'ins',
          amount: m(1200),
          frequency: 'annual',
          nextDue: '2027-04-10',
        }),
      ],
    })
    expect(y.total).toBe(m(37200))
    expect(y.perMonth).toBe(m(3100))
    expect(amountIn(y, '2027-04')).toBe(m(4200))
    expect(amountIn(y, '2027-05')).toBe(m(3000))
  })

  it('keeps twelve rents after this month’s is paid', () => {
    const y = year({
      bills: [bill({ id: 'rent', amount: m(3000), nextDue: '2026-12-01' })],
      txns: [tx({ billId: 'rent', amount: m(3000), date: '2026-11-01' })],
    })
    expect(y.total).toBe(m(36000))
    expect(amountIn(y, '2026-11')).toBe(m(3000))
  })

  it('counts a part-paid occurrence once', () => {
    const rent = bill({ id: 'rent', amount: m(3000), nextDue: '2026-11-20' })
    const [row] = plannedScenario({ bills: [rent], today: TODAY }).inputs
      .planned
    const y = year({
      bills: [rent],
      planned: [row],
      txns: [
        tx({
          billId: 'rent',
          plannedId: row.id,
          amount: m(1000),
          date: '2026-11-10',
        }),
      ],
    })
    expect(amountIn(y, '2026-11')).toBe(m(3000))
  })

  it('counts a one-off in its month and stops a bill at its end', () => {
    const y = year({
      bills: [
        bill({
          id: 'visa',
          amount: m(500),
          frequency: null,
          nextDue: '2027-02-01',
        }),
        bill({
          id: 'gym',
          amount: m(100),
          nextDue: '2026-12-01',
          endsOn: '2027-01-31',
        }),
      ],
    })
    expect(y.total).toBe(m(700))
  })

  it('leaves out closed bills and what falls outside the year', () => {
    const y = year({
      bills: [
        bill({ id: 'old', nextDue: '2026-12-01', closedAt: '2026-11-01' }),
        bill({
          id: 'later',
          amount: m(900),
          frequency: null,
          nextDue: '2027-11-01',
        }),
      ],
      txns: [tx({ billId: 'old', amount: m(50), date: '2026-10-30' })],
    })
    expect(y.total).toBe(0)
  })

  it('converts to base and splits out nice to have', () => {
    const y = year({
      bills: [
        bill({
          id: 'sub',
          amount: m(10),
          currency: 'USD',
          mustPay: false,
          frequency: null,
          nextDue: '2026-12-01',
        }),
      ],
    })
    expect(y.total).toBe(m(37.5))
    expect(y.niceToHave).toBe(m(37.5))
  })

  it('flags a varying bill and a bill with no amount as estimates', () => {
    const fixed = bill({ id: 'rent', nextDue: '2026-12-01' })
    expect(year({ bills: [fixed] }).estimated).toBe(false)
    expect(year({ bills: [{ ...fixed, amountVaries: true }] }).estimated).toBe(
      true,
    )
    expect(year({ bills: [{ ...fixed, amount: 0 }] }).estimated).toBe(true)
  })

  it('adds up income over the same months', () => {
    const y = year({ income: [income({ amount: m(12000), day: 25 })] })
    expect(y.income).toBe(m(144000))
  })
})
