import { useState } from 'react'
import type { RangeMode } from '#/features/transactions/constants'
import type { CalendarView } from '#/features/transactions/data/selectors'

/** A page of the calendar: `step` is where it came from — 1 later, -1 earlier, 0 no order. */
export type CalendarSlide = { index: number; step: -1 | 0 | 1 }

export type SlideState = {
  mode: RangeMode
  /** The selected period's first cell key — an ISO day, or a month in the year grid. */
  start: string
  slide: CalendarSlide
}

export function periodStart(calendar: CalendarView): string {
  const rows = [
    ...calendar.rowsBefore,
    calendar.pivotRow,
    ...calendar.rowsAfter,
  ]
  return rows.flat().find((c) => !c.outside)?.key ?? ''
}

const gridOf = (mode: RangeMode) => (mode === 'year' ? 'months' : 'days')

/**
 * Turns the page when the same view moves to another period, in the order of their ISO start
 * keys. A switch between the day and month grids fades; any other change of view keeps the page.
 */
export function nextSlide(
  prev: SlideState,
  mode: RangeMode,
  start: string,
): SlideState {
  const turn = (step: CalendarSlide['step']) => ({
    mode,
    start,
    slide: { index: prev.slide.index + 1, step },
  })
  if (mode !== prev.mode) {
    return gridOf(mode) === gridOf(prev.mode)
      ? { ...prev, mode, start }
      : turn(0)
  }
  if (start === prev.start) return prev
  return turn(start > prev.start ? 1 : -1)
}

export function useCalendarSlide(
  calendar: CalendarView,
  mode: RangeMode,
): CalendarSlide {
  const start = periodStart(calendar)
  const [state, setState] = useState<SlideState>({
    mode,
    start,
    slide: { index: 0, step: 0 },
  })

  if (mode !== state.mode || start !== state.start) {
    const next = nextSlide(state, mode, start)
    setState(next)
    return next.slide
  }
  return state.slide
}
