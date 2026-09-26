import { useState } from 'react'
import type { RangeMode } from '#/features/transactions/constants'
import {
  addDays,
  inWindow,
  parseISO,
  parseMonthKey,
  startOfWeek,
  windowOf,
  ymd,
} from '#/features/transactions/data/planning'

/** The Spending page's period: its range mode, its anchor date and every way to move them. */
export function useSpendingPeriod(today: Date) {
  const [mode, setMode] = useState<RangeMode>('month')
  const [anchor, setAnchor] = useState(() =>
    ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
  )

  const step = (dir: -1 | 1) => {
    const a = parseISO(anchor)
    if (mode === 'day') setAnchor(ymd(addDays(a, dir)))
    else if (mode === 'week') setAnchor(ymd(addDays(a, dir * 7)))
    else if (mode === 'year')
      setAnchor(ymd(new Date(a.getFullYear() + dir, 0, 1)))
    else setAnchor(ymd(new Date(a.getFullYear(), a.getMonth() + dir, 1)))
  }
  const changeMode = (next: RangeMode) => {
    const a = parseISO(anchor)
    // Switching views should never jump away from now: if the period being left already
    // covers today, re-anchor on today rather than on the period's own start.
    const at = inWindow(ymd(today), windowOf(a, mode)) ? today : a
    setAnchor(ymd(windowOf(at, next).start))
    setMode(next)
  }
  const goToToday = () => setAnchor(ymd(windowOf(today, mode).start))
  const pickMonth = (key: string) => {
    setMode('month')
    setAnchor(ymd(parseMonthKey(key)))
  }
  const pickDay = (key: string) => {
    if (mode === 'day' && anchor === key) {
      setMode('week')
      setAnchor(ymd(startOfWeek(parseISO(key))))
    } else {
      setMode('day')
      setAnchor(key)
    }
  }

  return {
    anchor,
    mode,
    step,
    changeMode,
    goToToday,
    pickMonth,
    pickDay,
  } as const
}
