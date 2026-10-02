import { describe, expect, it } from 'vitest'
import { m } from '#/features/planned/testing/fixtures'
import {
  CAFES,
  DINING,
  GROCERIES,
  HOUSING,
  INVESTING,
  OTHER,
  RENT,
  SALARY,
  flow,
  reportCatalog,
} from '#/features/reports/testing/fixtures'
import { buildNeedsWants, segmentsOf, verdictOf } from './needsWantsCard'
import { reportRange } from './range'

const TODAY = new Date(2026, 8, 29)
const catalog = reportCatalog()
const thisMonth = reportRange(
  'this_month',
  { start: '', end: '' },
  'prev',
  TODAY,
)

const build = (
  cur: ReturnType<typeof flow>[],
  over: Partial<Parameters<typeof buildNeedsWants>[0]> = {},
) =>
  buildNeedsWants({
    cur,
    prev: null,
    goalSetAside: 0,
    range: thisMonth,
    today: TODAY,
    catalog,
    base: 'SAR',
    ...over,
  })

const income = (amount: number, date = '2026-09-01') =>
  flow({ type: 'income', categoryId: SALARY, amount, date })

describe('buildNeedsWants', () => {
  it('splits income into needs, wants and the savings remainder', () => {
    const view = build([
      income(m(10_000)),
      flow({ categoryId: GROCERIES, amount: m(4_000) }),
      flow({ categoryId: CAFES, amount: m(3_500) }),
      flow({ categoryId: INVESTING, amount: m(1_000) }),
    ])
    expect(view.caption).toBe('of SR 10,000 income')
    expect(
      view.rows.map((r) => [r.label, r.amountStr, r.pctStr, r.guideline]),
    ).toEqual([
      ['Needs', 'SR 4,000', '40%', '≤ 50%'],
      ['Wants', 'SR 3,500', '35%', '≤ 30%'],
      ['Savings', 'SR 2,500', '25%', '≥ 20%'],
    ])
    expect(view.rows.map((r) => r.verdict?.text)).toEqual([
      '✓',
      'a little over',
      '✓',
    ])
    expect(view.rows[2].note).toBe('SR 1,000 into savings categories')
    expect(view.segments.map((s) => [s.key, s.widthPct])).toEqual([
      ['need', 40],
      ['want', 35],
      ['saving', 25],
    ])
    expect(view.ticks).toEqual([
      { label: '50', atPct: 50 },
      { label: '80', atPct: 80 },
    ])
    expect(view.unsorted).toBeNull()
  })

  it('captions what was set aside for goals under Savings', () => {
    const view = build([income(m(1_000))], { goalSetAside: m(300) })
    expect(view.rows[2].note).toBe('SR 300 set aside for goals')
  })

  it('shows not sorted on its own, naming the roots to tag', () => {
    const view = build([
      income(m(1_000)),
      flow({ categoryId: OTHER, amount: m(100) }),
    ])
    expect(view.unsorted).toMatchObject({
      amountStr: 'SR 100',
      pctStr: '10%',
      rootIds: [OTHER],
      actionLabel: 'Sort 1 category',
    })
    expect(view.segments.map((s) => s.key)).toEqual(['unsorted', 'saving'])
  })

  it('draws overspending as a red tail past where income ends', () => {
    const view = build([
      income(m(1_000)),
      flow({ categoryId: GROCERIES, amount: m(1_500) }),
      flow({ categoryId: CAFES, amount: m(500) }),
    ])
    expect(view.segments.map((s) => [s.key, s.widthPct])).toEqual([
      ['need', 37.5],
      ['want', 12.5],
      ['overspent', 50],
    ])
    expect(view.ticks.map((t) => t.atPct)).toEqual([25, 40])
    expect(view.rows[2]).toMatchObject({
      amountStr: '−SR 1,000',
      pctStr: '−100%',
      note: 'Overspent by SR 1,000',
    })
  })

  it('splits spending alone when nothing came in', () => {
    const view = build([flow({ categoryId: GROCERIES, amount: m(100) })])
    expect(view.noIncome).toBe(true)
    expect(view.caption).toBe('No income in this period')
    expect(view.ticks).toEqual([])
    expect(view.rows[0].pctStr).toBeNull()
    expect(view.segments[0].pctStr).toBe('100% of spending')
  })

  it('is empty with neither income nor spending', () => {
    expect(build([]).empty).toBe(true)
  })

  it('lists the categories behind each bucket, a subcategory under its root', () => {
    const view = build([
      income(m(1_000)),
      flow({ categoryId: RENT, amount: m(300) }),
      flow({ categoryId: GROCERIES, amount: m(100) }),
      flow({ categoryId: CAFES, amount: m(50) }),
    ])
    expect(view.rows[0].categories.map((c) => [c.rootId, c.shareStr])).toEqual([
      [HOUSING, '75%'],
      [GROCERIES, '25%'],
    ])
    expect(view.rows[1].categories.map((c) => c.rootId)).toEqual([DINING])
  })

  it('reads the comparison period share beside each bucket', () => {
    const view = build(
      [income(m(100)), flow({ categoryId: CAFES, amount: m(31) })],
      {
        prev: [income(m(100)), flow({ categoryId: CAFES, amount: m(27) })],
      },
    )
    expect(view.rows[1].wasStr).toBe('was 27%')
  })

  it('adds a month-by-month split from three months on, never for a month to come', () => {
    const sixMonths = reportRange(
      'last_6',
      { start: '', end: '' },
      'prev',
      TODAY,
    )
    const view = build(
      [
        income(m(100), '2026-04-01'),
        flow({ categoryId: GROCERIES, amount: m(50), date: '2026-04-03' }),
        income(m(100), '2026-09-01'),
      ],
      { range: sixMonths },
    )
    expect(view.months?.map((mo) => mo.label)).toEqual([
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
    ])
    expect(view.months?.[0].title).toBe(
      'April 2026: Needs 50% · Wants 0% · Savings 50%',
    )
    expect(view.months?.[1].title).toBe('May 2026: no income')
    expect(build([income(1)]).months).toBeNull()
  })
})

describe('verdictOf', () => {
  it('reads within, a little past and past each guideline', () => {
    expect(verdictOf('need', 50).text).toBe('✓')
    expect(verdictOf('need', 55).text).toBe('a little over')
    expect(verdictOf('need', 56).text).toBe('over')
    expect(verdictOf('saving', 20).text).toBe('✓')
    expect(verdictOf('saving', 16).text).toBe('a little under')
    expect(verdictOf('saving', 10)).toEqual({
      text: 'under',
      label: 'under',
      tone: 'warn',
    })
  })
})

describe('segmentsOf', () => {
  it('leaves out empty parts', () => {
    expect(
      segmentsOf(
        {
          income: 100,
          need: 100,
          want: 0,
          unsorted: 0,
          savedSpends: 0,
          savings: 0,
        },
        'SAR',
      ).map((s) => s.key),
    ).toEqual(['need'])
  })
})
