import { describe, expect, it } from 'vitest'
import { nextSlide } from './useCalendarSlide'
import type { SlideState } from './useCalendarSlide'
import type { RangeMode } from '#/features/transactions/constants'

const at = (mode: RangeMode, start: string): SlideState => ({
  mode,
  start,
  slide: { index: 3, step: 0 },
})

describe('nextSlide', () => {
  it('turns forward to a later period and back to an earlier one', () => {
    expect(
      nextSlide(at('week', '2026-09-20'), 'week', '2026-09-27').slide,
    ).toEqual({ index: 4, step: 1 })
    expect(
      nextSlide(at('week', '2026-09-20'), 'week', '2026-09-13').slide,
    ).toEqual({ index: 4, step: -1 })
  })

  it('crosses years in order', () => {
    expect(nextSlide(at('year', '2026-01'), 'year', '2027-01').slide.step).toBe(
      1,
    )
    expect(
      nextSlide(at('month', '2026-01-01'), 'month', '2025-12-01').slide.step,
    ).toBe(-1)
  })

  it('fades between the day and month grids', () => {
    expect(
      nextSlide(at('month', '2026-09-01'), 'year', '2026-01').slide,
    ).toEqual({
      index: 4,
      step: 0,
    })
  })

  it('keeps the page when the view changes within the day grid', () => {
    const next = nextSlide(at('week', '2026-09-20'), 'day', '2026-09-23')
    expect(next.slide).toEqual({ index: 3, step: 0 })
    expect(next).toMatchObject({ mode: 'day', start: '2026-09-23' })
  })

  it('keeps the page while nothing moved', () => {
    const prev = at('week', '2026-09-20')
    expect(nextSlide(prev, 'week', '2026-09-20')).toBe(prev)
  })
})
