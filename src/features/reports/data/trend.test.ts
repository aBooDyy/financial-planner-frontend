import { describe, expect, it } from 'vitest'
import { m } from '#/features/planned/testing/fixtures'
import { flow } from '#/features/reports/testing/fixtures'
import { bucketsOf } from './buckets'
import { reportRange } from './range'
import type { RangePreset } from './range'
import { buildTrend, niceMax } from './trend'

const TODAY = new Date(2026, 8, 29)

const trendOf = (
  rows: ReturnType<typeof flow>[],
  preset: RangePreset = 'this_month',
  custom = { start: '', end: '' },
) => {
  const range = reportRange(preset, custom, 'none', TODAY)
  const seen: string[] = []
  const balance = (iso: string) => {
    seen.push(iso)
    return Number(iso.slice(8)) * 100
  }
  return {
    view: buildTrend(rows, bucketsOf(range, TODAY), range, balance, 'SAR'),
    seen,
  }
}

const rows = [
  flow({ type: 'income', amount: m(5000), date: '2026-09-01' }),
  flow({ type: 'spend', amount: m(1000), date: '2026-09-10' }),
  flow({ type: 'spend', amount: m(300), date: '2026-09-29' }),
]

describe('niceMax', () => {
  it('rounds up to a round axis top', () => {
    expect(niceMax(1200)).toBe(1200)
    expect(niceMax(1300)).toBe(1500)
    expect(niceMax(1000)).toBe(1000)
    expect(niceMax(101)).toBe(120)
    expect(niceMax(99)).toBe(100)
    expect(niceMax(8001)).toBe(10_000)
    expect(niceMax(1)).toBe(1)
  })

  it('falls back to 100 with nothing to show', () => {
    expect(niceMax(0)).toBe(100)
    expect(niceMax(-50)).toBe(100)
  })
})

describe('buildTrend', () => {
  it('sizes each column against the axis top', () => {
    const { view } = trendOf(rows)
    expect(view.sub).toBe('By week')
    expect(view.columns.map((c) => c.key)).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ])
    expect(view.columns.map((c) => [c.incomePct, c.spendingPct])).toEqual([
      [100, 0],
      [0, 20],
      [0, 0],
      [0, 0],
      [0, 6],
    ])
    expect(view.grid).toEqual([
      { label: '5k', pct: 100 },
      { label: '2.5k', pct: 50 },
      { label: '0', pct: 0 },
    ])
  })

  it('reads each column out, with the balance going in and at its end or today', () => {
    const { view, seen } = trendOf(rows)
    expect(view.columns[0].readout).toEqual({
      title: 'Sep 1 – 7, 2026',
      incomeStr: 'SR 5,000',
      spendingStr: 'SR 0',
      netStr: '+SR 5,000',
      netPositive: true,
      balance: { startStr: 'SR 31', endStr: 'SR 7' },
    })
    expect(view.columns[1].readout?.netStr).toBe('−SR 1,000')
    expect(view.columns[1].readout?.netPositive).toBe(false)
    expect(view.columns[1].readout?.balance?.startStr).toBe('SR 7')
    expect(view.columns[4].readout?.balance).toEqual({
      startStr: 'SR 28',
      endStr: 'SR 29',
    })
    expect(seen.at(-1)).toBe('2026-09-29')
  })

  it('reads the whole running period as "so far" with no balance', () => {
    const { view } = trendOf(rows)
    expect(view.whole).toEqual({
      title: 'So far',
      incomeStr: 'SR 5,000',
      spendingStr: 'SR 1,300',
      netStr: '+SR 3,700',
      netPositive: true,
      balance: null,
    })
    expect(trendOf([], 'last_month').view.whole.title).toBe('Whole period')
  })

  it('draws future columns empty, with no readout', () => {
    const { view } = trendOf(rows, 'custom', {
      start: '2026-09-15',
      end: '2026-10-15',
    })
    expect(view.sub).toBe('By week · remaining weeks shown empty')
    expect(view.columns.map((c) => c.future)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ])
    expect(view.columns[3].readout).toBeNull()
    expect(view.columns[4].readout).toBeNull()
    expect(view.columns[2].readout?.spendingStr).toBe('SR 300')
  })

  it('keeps a flat axis when nothing was recorded', () => {
    const { view } = trendOf([], 'last_6')
    expect(view.sub).toBe('By month')
    expect(
      view.columns.every((c) => c.incomePct === 0 && c.spendingPct === 0),
    ).toBe(true)
    expect(view.grid.map((g) => g.label)).toEqual(['100', '50', '0'])
  })
})
