import { describe, expect, it } from 'vitest'
import { customRangePresets, customRangeProblem } from './customRange'

describe('customRangePresets', () => {
  it('ends every preset today', () => {
    const presets = customRangePresets(new Date(2026, 8, 28))
    expect(presets.map((p) => [p.key, p.span.start, p.span.end])).toEqual([
      ['7d', '2026-09-22', '2026-09-28'],
      ['30d', '2026-08-30', '2026-09-28'],
      ['90d', '2026-07-01', '2026-09-28'],
      ['ytd', '2026-01-01', '2026-09-28'],
    ])
  })
})

describe('customRangeProblem', () => {
  it('needs both dates, the start no later than the end', () => {
    expect(customRangeProblem({ start: '', end: '2026-09-28' })).toBe(
      'Pick both dates',
    )
    expect(customRangeProblem({ start: '2026-09-29', end: '2026-09-28' })).toBe(
      'The start must be on or before the end',
    )
    expect(
      customRangeProblem({ start: '2026-09-28', end: '2026-09-28' }),
    ).toBeNull()
  })
})
