import { describe, expect, it } from 'vitest'
import { nextSlide } from './useCalendarSlide'
import type { SlideState } from './useCalendarSlide'
import type { PeriodMode } from '#/features/transactions/constants'

const gridOf = (mode: PeriodMode) => (mode === 'year' ? 'months' : 'days')

const at = (mode: PeriodMode, start: string): SlideState => ({
  mode,
  grid: gridOf(mode),
  start,
  slide: { index: 3, step: 0 },
})

describe('nextSlide', () => {
  it('turns forward to a later period and back to an earlier one', () => {
    expect(
      nextSlide(at('week', '2026-09-20'), 'week', gridOf('week'), '2026-09-27')
        .slide,
    ).toEqual({ index: 4, step: 1 })
    expect(
      nextSlide(at('week', '2026-09-20'), 'week', gridOf('week'), '2026-09-13')
        .slide,
    ).toEqual({ index: 4, step: -1 })
  })

  it('crosses years in order', () => {
    expect(
      nextSlide(at('year', '2026-01'), 'year', gridOf('year'), '2027-01').slide
        .step,
    ).toBe(1)
    expect(
      nextSlide(
        at('month', '2026-01-01'),
        'month',
        gridOf('month'),
        '2025-12-01',
      ).slide.step,
    ).toBe(-1)
  })

  it('fades between the day and month grids', () => {
    expect(
      nextSlide(at('month', '2026-09-01'), 'year', gridOf('year'), '2026-01')
        .slide,
    ).toEqual({
      index: 4,
      step: 0,
    })
  })

  it('keeps the page when the view changes within the day grid', () => {
    const next = nextSlide(
      at('week', '2026-09-20'),
      'day',
      gridOf('day'),
      '2026-09-23',
    )
    expect(next.slide).toEqual({ index: 3, step: 0 })
    expect(next).toMatchObject({ mode: 'day', start: '2026-09-23' })
  })

  it('fades when a custom span changes grid, and turns while it keeps one', () => {
    const long = { ...at('custom', '2026-01'), grid: 'months' as const }
    expect(nextSlide(long, 'custom', 'days', '2026-09-01').slide.step).toBe(0)
    expect(
      nextSlide(at('custom', '2026-09-01'), 'custom', 'days', '2026-09-15')
        .slide.step,
    ).toBe(1)
  })

  it('keeps the page while nothing moved', () => {
    const prev = at('week', '2026-09-20')
    expect(nextSlide(prev, 'week', gridOf('week'), '2026-09-20')).toBe(prev)
  })
})
