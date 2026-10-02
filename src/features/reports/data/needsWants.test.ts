import { describe, expect, it } from 'vitest'
import { RATES, m, tx } from '#/features/planned/testing/fixtures'
import {
  CAFES,
  GROCERIES,
  INVESTING,
  OTHER,
  RENT,
  SALARY,
  flow,
  reportCatalog,
} from '#/features/reports/testing/fixtures'
import {
  needsWantsSummary,
  needsWantsTotals,
  roundTo100,
  sharesLine,
  sharesOf,
} from './needsWants'

const catalog = reportCatalog()

describe('needsWantsTotals', () => {
  it('buckets spends by their resolved tag and keeps savings as the remainder', () => {
    const t = needsWantsTotals(
      [
        flow({ type: 'income', categoryId: SALARY, amount: m(10_000) }),
        flow({ categoryId: GROCERIES, amount: m(3_000) }),
        flow({ categoryId: RENT, amount: m(1_000) }),
        flow({ categoryId: CAFES, amount: m(2_000) }),
        flow({ categoryId: OTHER, amount: m(500) }),
        flow({ categoryId: INVESTING, amount: m(1_500) }),
      ],
      catalog,
    )
    expect(t).toEqual({
      income: m(10_000),
      need: m(4_000),
      want: m(2_000),
      unsorted: m(500),
      savedSpends: m(1_500),
      savings: m(3_500),
    })
  })

  it('goes negative when more went out than came in', () => {
    const t = needsWantsTotals(
      [
        flow({ type: 'income', categoryId: SALARY, amount: m(1_000) }),
        flow({ categoryId: GROCERIES, amount: m(1_400) }),
      ],
      catalog,
    )
    expect(t.savings).toBe(-m(400))
  })
})

describe('sharesOf', () => {
  it('rounds the four parts to exactly 100', () => {
    const shares = sharesOf({
      income: 300,
      need: 100,
      want: 100,
      unsorted: 0,
      savedSpends: 0,
      savings: 100,
    })
    expect(shares).toEqual({ need: 34, want: 33, unsorted: 0, saving: 33 })
  })

  it('is null without income, and lets an overspent savings go negative', () => {
    expect(
      sharesOf({
        income: 0,
        need: 100,
        want: 0,
        unsorted: 0,
        savedSpends: 0,
        savings: -100,
      }),
    ).toBeNull()
    expect(
      sharesOf({
        income: 1_000,
        need: 900,
        want: 300,
        unsorted: 0,
        savedSpends: 0,
        savings: -200,
      }),
    ).toEqual({ need: 90, want: 30, unsorted: 0, saving: -20 })
  })

  it('keeps whole parts whole', () => {
    expect(roundTo100([48, 31, 0, 21])).toEqual([48, 31, 0, 21])
  })
})

describe('sharesLine', () => {
  it('reads the three buckets, and not sorted only when there is some', () => {
    expect(sharesLine({ need: 48, want: 31, unsorted: 0, saving: 21 })).toBe(
      'Needs 48% · Wants 31% · Savings 21%',
    )
    expect(sharesLine({ need: 48, want: 30, unsorted: 2, saving: 20 })).toBe(
      'Needs 48% · Wants 30% · Not sorted 2% · Savings 20%',
    )
  })
})

describe('needsWantsSummary', () => {
  it('reads only live spend and income in the span, across every account', () => {
    const summary = needsWantsSummary({
      rows: [
        tx({
          type: 'income',
          categoryId: SALARY,
          amount: m(1_000),
          date: '2026-09-01',
        }),
        tx({
          categoryId: GROCERIES,
          amount: m(480),
          walletId: 'w2',
          date: '2026-09-10',
        }),
        tx({ categoryId: CAFES, amount: m(310), date: '2026-09-30' }),
        tx({ categoryId: CAFES, amount: m(999), date: '2026-10-01' }),
        tx({
          categoryId: CAFES,
          amount: m(999),
          date: '2026-09-15',
          deleted: 1,
        }),
        tx({
          type: 'transfer_out',
          categoryId: null,
          amount: m(999),
          transferId: 'x',
          date: '2026-09-15',
        }),
      ],
      from: '2026-09-01',
      to: '2026-09-30',
      catalog,
      base: 'SAR',
      rates: RATES,
    })
    expect(summary.line).toBe('Needs 48% · Wants 31% · Savings 21%')
    expect(summary.totals.savings).toBe(m(210))
  })

  it('has no line without income', () => {
    const summary = needsWantsSummary({
      rows: [tx({ categoryId: GROCERIES, date: '2026-09-10' })],
      from: '2026-09-01',
      to: '2026-09-30',
      catalog,
      base: 'SAR',
      rates: RATES,
    })
    expect(summary.shares).toBeNull()
    expect(summary.line).toBeNull()
  })
})
