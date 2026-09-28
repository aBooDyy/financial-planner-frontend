import { useState } from 'react'
import type { RangeMode } from '#/features/transactions/constants'
import {
  addDays,
  daysIn,
  fromIsoPeriod,
  inWindow,
  parseISO,
  parseMonthKey,
  periodOf,
  startOfWeek,
  toIsoPeriod,
  ymd,
} from '#/features/transactions/data/planning'
import type { IsoSpan } from '#/features/transactions/data/customRange'
import type { IsoPeriod, Period } from '#/features/transactions/data/planning'

/** The period `dir` steps away: a range mode's neighbour, or a custom span shifted by its length. */
export function steppedPeriod(period: Period, dir: -1 | 1): Period {
  const { mode, start } = period
  if (mode === 'custom') {
    const by = dir * daysIn(period)
    return {
      mode,
      start: addDays(start, by),
      end: addDays(period.end, by),
    }
  }
  if (mode === 'day') return periodOf(addDays(start, dir), mode)
  if (mode === 'week') return periodOf(addDays(start, dir * 7), mode)
  if (mode === 'year')
    return periodOf(new Date(start.getFullYear() + dir, 0, 1), mode)
  return periodOf(
    new Date(start.getFullYear(), start.getMonth() + dir, 1),
    mode,
  )
}

/** The same kind of period, moved to hold today; a custom span keeps its length and ends today. */
export function periodHoldingToday(period: Period, today: Date): Period {
  if (period.mode !== 'custom') return periodOf(today, period.mode)
  return {
    mode: 'custom',
    start: addDays(today, 1 - daysIn(period)),
    end: today,
  }
}

/** The Spending page's period: a range mode or a custom span, and every way to move it. */
export function useSpendingPeriod(today: Date) {
  const [selected, setIso] = useState<IsoPeriod>(() =>
    toIsoPeriod(periodOf(today, 'month')),
  )
  const current = fromIsoPeriod(selected)
  const set = (next: Period) => setIso(toIsoPeriod(next))

  const step = (dir: -1 | 1) => set(steppedPeriod(current, dir))
  const changeMode = (next: RangeMode) => {
    // Switching views should never jump away from now: if the period being left already
    // covers today, re-anchor on today rather than on the period's own start.
    const at = inWindow(ymd(today), current) ? today : current.start
    set(periodOf(at, next))
  }
  const pickCustom = ({ start, end }: IsoSpan) =>
    setIso({ mode: 'custom', start, end })
  const goToToday = () => set(periodHoldingToday(current, today))
  const pickMonth = (key: string) => set(periodOf(parseMonthKey(key), 'month'))
  const pickDay = (key: string) => {
    if (selected.mode === 'day' && selected.start === key)
      set(periodOf(startOfWeek(parseISO(key)), 'week'))
    else set(periodOf(parseISO(key), 'day'))
  }

  return {
    selected,
    step,
    changeMode,
    pickCustom,
    goToToday,
    pickMonth,
    pickDay,
  } as const
}
