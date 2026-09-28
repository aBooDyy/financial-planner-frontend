import { useState } from 'react'
import type { PeriodMode } from '#/features/transactions/constants'
import type { CalendarView } from '#/features/transactions/data/selectors'

/** A page of the calendar: `step` is where it came from — 1 later, -1 earlier, 0 no order. */
export type CalendarSlide = { index: number; step: -1 | 0 | 1 }

export type SlideState = {
  mode: PeriodMode
  grid: CalendarView['grid']
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

/**
 * Turns the page when the same view moves to another period, in the order of their ISO start
 * keys. A switch between the day and month grids fades; any other change of view keeps the page.
 */
export function nextSlide(
  prev: SlideState,
  mode: PeriodMode,
  grid: CalendarView['grid'],
  start: string,
): SlideState {
  const turn = (step: CalendarSlide['step']) => ({
    mode,
    grid,
    start,
    slide: { index: prev.slide.index + 1, step },
  })
  if (grid !== prev.grid) return turn(0)
  if (mode !== prev.mode) return { ...prev, mode, start }
  if (start === prev.start) return prev
  return turn(start > prev.start ? 1 : -1)
}

export function useCalendarSlide(
  calendar: CalendarView,
  mode: PeriodMode,
): CalendarSlide {
  const start = periodStart(calendar)
  const { grid } = calendar
  const [state, setState] = useState<SlideState>({
    mode,
    grid,
    start,
    slide: { index: 0, step: 0 },
  })

  if (mode !== state.mode || grid !== state.grid || start !== state.start) {
    const next = nextSlide(state, mode, grid, start)
    setState(next)
    return next.slide
  }
  return state.slide
}
