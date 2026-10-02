import { describe, expect, it } from 'vitest'
import type { LocalBudget } from '#/db/types'
import { income } from '#/features/planned/testing/fixtures'
import { ledgerRanges, mergeRanges } from './ledgerRange'
import { parseISO, periodOf } from './planning'

const budget = (over: Partial<LocalBudget>): LocalBudget => ({
  id: 'b',
  scopeType: 'overall',
  categoryId: null,
  walletId: null,
  period: 'monthly',
  customDays: null,
  limit: 1,
  currency: 'SAR',
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

// A Saturday; its week runs Sun 20 – Sat 26 September.
const TODAY = new Date(2026, 8, 26)

describe('mergeRanges', () => {
  it('sorts, joins overlapping and nested spans, and keeps disjoint ones apart', () => {
    expect(
      mergeRanges([
        ['2026-05-01', '2026-05-31'],
        ['2026-01-01', '2026-01-10'],
        ['2026-05-20', '2026-06-10'],
        ['2026-05-02', '2026-05-03'],
        ['2026-01-10', '2026-01-12'],
      ]),
    ).toEqual([
      ['2026-01-01', '2026-01-12'],
      ['2026-05-01', '2026-06-10'],
    ])
  })

  it('answers nothing for nothing', () => {
    expect(mergeRanges([])).toEqual([])
  })
})

describe('ledgerRanges', () => {
  it('month: the whole-week grid around the month, spilling into its neighbours', () => {
    // March 2026 starts on a Sunday and ends on a Tuesday: the grid runs Mar 1 – Apr 4.
    expect(
      ledgerRanges(periodOf(new Date(2026, 2, 1), 'month'), TODAY, []),
    ).toEqual([['2026-03-01', '2026-04-04']])
    // September 2026 starts on a Tuesday: the grid opens on Sun Aug 30.
    expect(
      ledgerRanges(periodOf(new Date(2026, 8, 1), 'month'), TODAY, []),
    ).toEqual([['2026-08-30', '2026-10-03']])
  })

  it('week and day: still the anchor month grid, which the calendar keeps drawing', () => {
    expect(
      ledgerRanges(periodOf(new Date(2026, 3, 30), 'day'), TODAY, []),
    ).toEqual([['2026-03-29', '2026-05-02']])
    // The week of Sun Jun 28 is anchored on its start, so June's grid is the one drawn.
    expect(
      ledgerRanges(periodOf(new Date(2026, 5, 28), 'week'), TODAY, []),
    ).toEqual([['2026-05-31', '2026-07-04']])
  })

  it('year: exactly the calendar year', () => {
    expect(
      ledgerRanges(periodOf(new Date(2025, 0, 1), 'year'), TODAY, []),
    ).toEqual([['2025-01-01', '2025-12-31']])
  })

  it('custom: the span with the whole weeks it touches, or just the span once drawn as months', () => {
    const custom = (start: string, end: string) => ({
      mode: 'custom' as const,
      start: parseISO(start),
      end: parseISO(end),
    })
    expect(ledgerRanges(custom('2026-06-03', '2026-07-14'), TODAY, [])).toEqual(
      [['2026-05-31', '2026-07-18']],
    )
    expect(ledgerRanges(custom('2025-11-15', '2026-02-10'), TODAY, [])).toEqual(
      [['2025-11-15', '2026-02-10']],
    )
  })

  it('adds each live budget window, measured from today rather than the anchor', () => {
    const budgets = [
      budget({ id: 'w', period: 'weekly' }),
      budget({ id: 'm', period: 'monthly' }),
      budget({ id: 'c', period: 'custom', customDays: 10 }),
      budget({ id: 'gone', period: 'custom', customDays: 900, deleted: 1 }),
    ]
    expect(
      ledgerRanges(periodOf(new Date(2025, 2, 1), 'month'), TODAY, budgets),
    ).toEqual([
      ['2025-02-23', '2025-04-05'],
      ['2026-09-01', '2026-09-30'],
    ])
  })

  it('a custom budget without a length reads the 30-day default', () => {
    const budgets = [budget({ period: 'custom', customDays: null })]
    expect(
      ledgerRanges(periodOf(new Date(2025, 0, 1), 'year'), TODAY, budgets),
    ).toEqual([
      ['2025-01-01', '2025-12-31'],
      ['2026-08-28', '2026-09-26'],
    ])
  })

  it('joins the budget spans into the period when they overlap', () => {
    const budgets = [budget({ period: 'custom', customDays: 400 })]
    expect(
      ledgerRanges(periodOf(new Date(2026, 8, 1), 'month'), TODAY, budgets),
    ).toEqual([['2025-08-23', '2026-10-03']])
  })

  it('reads a per-paycheck budget over the pay period today falls in', () => {
    const budgets = [budget({ period: 'paycheck' })]
    const cal = {
      kind: 'paycheck' as const,
      stream: income({ day: 25 }),
      perYear: 12,
    }
    expect(
      ledgerRanges(periodOf(new Date(2025, 0, 1), 'year'), TODAY, budgets, cal),
    ).toEqual([
      ['2025-01-01', '2025-12-31'],
      ['2026-09-25', '2026-10-24'],
    ])
  })
})
