/**
 * How Planning writes money, dates and cadence: whole currency units (planning figures are
 * rounded), short English dates, and "a paycheck" or "a month" depending on the pay calendar.
 */
import { dateOf, daysBetween } from '#/features/planned/data/dates'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import { formatMoneyRounded, numberFormat, toMajor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/** "SR 3,000". */
export const money = (minor: number, currency: CurrencyCode): string =>
  formatMoneyRounded(minor, currency)

/** "−SR 3,000" for a negative amount, else as `money`. */
export const signedMoney = (minor: number, currency: CurrencyCode): string =>
  minor < 0 ? `−${money(-minor, currency)}` : money(minor, currency)

/** "Oct 18". */
export const dayMonth = (iso: string): string =>
  dateOf(iso).toLocaleString('en-US', { month: 'short', day: 'numeric' })

/** "Mar 15", or "Mar 15, 2028" once it is about a year or more away. */
export const dueDay = (iso: string, today: string): string =>
  daysBetween(today, iso) < 330 ? dayMonth(iso) : fullDate(iso)

/** "Jun 2027". */
export const monthYear = (iso: string): string =>
  dateOf(iso).toLocaleString('en-US', { month: 'short', year: 'numeric' })

/** "Nov 1, 2026". */
export const fullDate = (iso: string): string =>
  dateOf(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

/** "Nov" — a month column's head. */
export const monthShort = (iso: string): string =>
  dateOf(iso).toLocaleString('en-US', { month: 'short' })

/** "1st", "22nd", "25th". */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** "a paycheck", or "a month" when pay periods are calendar months. */
export const perPeriod = (calendar: PayCalendar): string =>
  calendar.kind === 'paycheck' ? 'a paycheck' : 'a month'

/** "each paycheck" / "each month". */
export const eachPeriod = (calendar: PayCalendar): string =>
  calendar.kind === 'paycheck' ? 'each paycheck' : 'each month'

/** "Today", "Tomorrow", "in 5 days", "Oct 18" — how far off a due date is. */
export function dueIn(date: string, today: string): string {
  const days = daysBetween(today, date)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days < 0) return 'Overdue'
  return `Due in ${days} days`
}

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`

/** "2,400" — a whole amount without its currency, for "800 / 2,400". */
export const figure = (minor: number, currency: CurrencyCode): string =>
  numberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(toMajor(minor, currency)),
  )
