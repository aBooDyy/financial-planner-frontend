import { describe, expect, it } from 'vitest'
import type { SafeToSpend } from '#/features/planning/data/safeToSpend'
import { budgetsCaption, safeHeaderView } from './safeHeader'

const term = (total: number) => ({ total, items: [] })
const safe = (over: Partial<SafeToSpend> = {}): SafeToSpend => ({
  horizon: 'until_payday',
  end: '2026-10-24',
  payday: '2026-10-25',
  balance: 540_000,
  setAside: 190_000,
  free: 350_000,
  bills: term(65_000),
  setAsides: term(0),
  income: term(0),
  safe: 285_000,
  shortBy: 0,
  ...over,
})
const view = (s: SafeToSpend, budgets = []) =>
  safeHeaderView({ safe: s, base: 'SAR', today: '2026-10-14', budgets })

describe('safeHeaderView', () => {
  it('states the window and lays out the sum that ends in the headline', () => {
    const v = view(safe())
    expect(v.safeStr).toBe('SR 2,850.00')
    expect(v.windowStr).toBe('until payday · Oct 25')
    expect(v.negative).toBe(false)
    expect(v.shortStr).toBeNull()
    expect(v.lines.map((l) => [l.op, l.label, l.amountStr, l.link])).toEqual([
      ['', 'Balance', 'SR 5,400.00', null],
      ['−', 'Set aside', 'SR 1,900.00', 'setAsides'],
      ['−', 'Bills before payday', 'SR 650.00', 'upcoming'],
    ])
    expect(v.lines[2].hint).toBe('not set aside yet')
  })

  it('adds the other terms only when they count', () => {
    const v = view(
      safe({
        horizon: 'days',
        payday: null,
        end: '2026-10-28',
        setAsides: term(10_000),
        income: term(50_000),
      }),
    )
    expect(v.windowStr).toBe('next 14 days')
    expect(v.lines.map((l) => `${l.op}${l.label}`)).toEqual([
      'Balance',
      '−Set aside',
      '−Bills in the next 14 days',
      '−To set aside in the next 14 days',
      '+Income in the next 14 days',
    ])
  })

  it('reads a month-end window by its date', () => {
    const v = view(
      safe({ horizon: 'end_of_month', payday: null, end: '2026-10-31' }),
    )
    expect(v.windowStr).toBe('until Oct 31')
    expect(v.lines[2].label).toBe('Bills by Oct 31')
  })

  it('says how short it falls when below zero', () => {
    const v = view(safe({ safe: -30_000, shortBy: 30_000 }))
    expect(v.negative).toBe(true)
    expect(v.safeStr).toBe('−SR 300.00')
    expect(v.shortStr).toBe('SR 300.00 short before payday')
  })
})

describe('budgetsCaption', () => {
  const left = (
    name: string,
    amount: number,
    windowLabel = 'this paycheck',
  ) => ({
    id: name,
    name,
    left: amount,
    currency: 'SAR',
    windowLabel,
  })

  it('lists what each budget still allows, never more than three', () => {
    expect(
      budgetsCaption([left('Groceries', 60_000), left('Dining', 15_000)]),
    ).toBe('Budgets left until payday: Groceries SR 600.00 · Dining SR 150.00')
    expect(
      budgetsCaption([
        left('Groceries', 60_000, 'this month'),
        left('Dining', -5_000, 'this month'),
        left('Fuel', 1, 'this month'),
        left('Gifts', 1, 'this month'),
      ]),
    ).toBe(
      'Budgets left this month: Groceries SR 600.00 · Dining over by SR 50.00 · Fuel SR 0.01 · +1 more',
    )
    expect(budgetsCaption([left('A', 100), left('B', 100, 'this week')])).toBe(
      'Budgets left: A SR 1.00 · B SR 1.00',
    )
    expect(budgetsCaption([])).toBeNull()
  })
})
