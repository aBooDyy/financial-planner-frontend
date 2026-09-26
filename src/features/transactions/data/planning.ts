/**
 * Date math for the spending views. Everything is parameterized by `today` (local midnight)
 * so the selectors stay pure and testable. Wire dates are ISO `YYYY-MM-DD` strings; these
 * helpers convert at the edge. Ported from the design's date helpers.
 */
import { FREQUENCIES } from '#/features/goals/constants'
import type { GoalFrequency } from '#/features/goals/api/types'
import type { RangeMode } from '#/features/transactions/constants'
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

/** A budget's measurement window, always ending today (weekly / monthly / custom-N-days). */
export const budgetWindow = (
  period: 'weekly' | 'monthly' | 'custom',
  customDays: number | null,
  today: Date,
): DateWindow => {
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

/** Human "overdue" / "today" / "in 3d" / "in 2w" for a future-ish date. */
export const relFuture = (iso: string, today: Date): string => {
  const days = Math.round(
    (midnight(parseISO(iso)) - midnight(today)) / 86_400_000,
  )
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 7) return `in ${days}d`
  return `in ${Math.round(days / 7)}w`
}

/** Advance a recurring schedule one cadence forward from its current next-due. */
export const advanceDue = (iso: string, freq: GoalFrequency): string => {
  const d = parseISO(iso)
  const step: Record<GoalFrequency, () => Date> = {
    weekly: () => addDays(d, 7),
    monthly: () => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()),
    quarterly: () => new Date(d.getFullYear(), d.getMonth() + 3, d.getDate()),
    semi: () => new Date(d.getFullYear(), d.getMonth() + 6, d.getDate()),
    annual: () => new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()),
  }
  return ymd(step[freq]())
}

/** Normalize a recurring amount to a per-month figure using its cadence. */
export const monthlyFactor = (freq: GoalFrequency): number =>
  FREQUENCIES[freq].perYear / 12
