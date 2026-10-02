/**
 * Date math for the spending views. Everything is parameterized by `today` (local midnight)
 * so the selectors stay pure and testable. Wire dates are ISO `YYYY-MM-DD` strings; these
 * helpers convert at the edge. Ported from the design's date helpers.
 */
import { periodOf as payPeriodOf } from '#/features/planning/data/payPeriods'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import type { BudgetPeriod } from '#/features/transactions/api/types'
import type { PeriodMode, RangeMode } from '#/features/transactions/constants'
import { toMajor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

export type DateWindow = { start: Date; end: Date }

export const startOfToday = (): Date => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseISO = (s: string | null): Date => {
  const parts = String(s ?? '').split('-')
  return new Date(
    Number(parts[0]) || 1970,
    (Number(parts[1]) || 1) - 1,
    parts[2] ? Number(parts[2]) : 1,
  )
}

export const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export const addMonths = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth() + n, 1)

export const startOfWeek = (d: Date): Date => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - x.getDay())
  return x
}

export const dayKey = (d: Date): string => ymd(d)

export const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

/** `"2026-06"` back to the first of that month; anything malformed lands on Jan 1970. */
export const parseMonthKey = (s: string): Date => {
  const [y, m] = String(s).split('-')
  return new Date(Number(y) || 1970, (Number(m) || 1) - 1, 1)
}

export const sameMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const midnight = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export const fmtShort = (d: Date): string =>
  d.toLocaleString('en-US', { month: 'short', day: 'numeric' })

export const fmtMonth = (d: Date): string =>
  d.toLocaleString('en-US', { month: 'long', year: 'numeric' })

export const fmtMonthShort = (d: Date): string =>
  d.toLocaleString('en-US', { month: 'short' })

/**
 * Compact figure for calendar cells, from minor units: 1200 → "12", 123_400 → "1.2k".
 * Callers hold minor units everywhere, so the major conversion belongs here.
 */
export const fmtK = (amountMinor: number, code: CurrencyCode): string => {
  const n = Math.round(toMajor(amountMinor, code))
  if (n >= 10000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`
  return `${n}`
}

/** The [start, end] window for a range mode anchored at `anchor`. */
export const windowOf = (anchor: Date, mode: RangeMode): DateWindow => {
  if (mode === 'day') return { start: anchor, end: anchor }
  if (mode === 'week') {
    const s = startOfWeek(anchor)
    return { start: s, end: addDays(s, 6) }
  }
  if (mode === 'year')
    return {
      start: new Date(anchor.getFullYear(), 0, 1),
      end: new Date(anchor.getFullYear(), 11, 31),
    }
  return {
    start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
    end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
  }
}

/** The span the Spending page shows; a range mode's always starts where `windowOf` does. */
export type Period = DateWindow & { mode: PeriodMode }

/** A `Period` as wire ISO dates, the shape state and query keys hold. */
export type IsoPeriod = { mode: PeriodMode; start: string; end: string }

export const periodOf = (anchor: Date, mode: RangeMode): Period => ({
  mode,
  ...windowOf(anchor, mode),
})

export const toIsoPeriod = (p: Period): IsoPeriod => ({
  mode: p.mode,
  start: ymd(p.start),
  end: ymd(p.end),
})

export const fromIsoPeriod = (p: IsoPeriod): Period => ({
  mode: p.mode,
  start: parseISO(p.start),
  end: parseISO(p.end),
})

/** Days in a window, both ends included. */
export const daysIn = (win: DateWindow): number =>
  Math.round((midnight(win.end) - midnight(win.start)) / 86_400_000) + 1

export const inWindow = (iso: string, win: DateWindow): boolean => {
  const x = midnight(parseISO(iso))
  return x >= midnight(win.start) && x <= midnight(win.end)
}

/** Where today sits against a period: inside it (`null`), after it, or before it. */
export const todayRelativeTo = (
  win: DateWindow,
  today: Date,
): 'ahead' | 'behind' | null =>
  inWindow(ymd(today), win) ? null : today > win.end ? 'ahead' : 'behind'

/**
 * A budget's measurement window around today: this week, this month, the last N days, or the
 * pay period today falls in. Without a main paycheck the pay calendar is calendar months, so a
 * per-paycheck budget then resets monthly.
 */
const MONTHS: PayCalendar = { kind: 'month', perYear: 12 }

export const budgetWindow = (
  period: BudgetPeriod,
  customDays: number | null,
  today: Date,
  payCalendar: PayCalendar = MONTHS,
): DateWindow => {
  if (period === 'paycheck') {
    const { start, end } = payPeriodOf(payCalendar, ymd(today))
    return { start: parseISO(start), end: parseISO(end) }
  }
  if (period === 'weekly') {
    const s = startOfWeek(today)
    return { start: s, end: addDays(s, 6) }
  }
  if (period === 'custom') {
    const dd = customDays && customDays > 0 ? customDays : 30
    return { start: addDays(today, -(dd - 1)), end: today }
  }
  return {
    start: new Date(today.getFullYear(), today.getMonth(), 1),
    end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
  }
}
