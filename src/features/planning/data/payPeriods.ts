/**
 * Pay periods — the unit the plan is made in. One income stream, the **main paycheck**, sets
 * them: a period runs from one of its paydays to the day before the next. Without a main
 * paycheck (no income, or income that varies) periods are calendar months starting on the 1st.
 * Pure and clock-free: `today` is always passed in.
 */
import type { LocalIncomeStream } from '#/db/types'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import { paydaysOf } from '#/features/goals/data/paydays'
import { addDaysISO, dateOf, isoOf } from '#/features/planned/data/dates'
import type { PlanningSettings } from '#/features/wallets/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'

export type PayCalendar =
  | { kind: 'paycheck'; stream: LocalIncomeStream; perYear: number }
  | { kind: 'month'; perYear: number }

export type PayPeriod = {
  /** The payday that opens it (ISO); the period's first day. */
  start: string
  /** The day before the next payday. */
  end: string
}

/** Far enough that every cadence has a payday on either side of any date. */
const SEARCH_DAYS = 400
/** Safe to spend falls back to this many days when there is no reliable payday. */
export const FALLBACK_HORIZON_DAYS = 30

export const isStreamActive = (
  s: Pick<LocalIncomeStream, 'deleted' | 'endsOn'>,
  today: string,
): boolean => s.deleted === 0 && (s.endsOn === null || s.endsOn >= today)

/** A stream's pay in base minor units per month, on average. */
export const monthlyIncomeOf = (
  s: LocalIncomeStream,
  base: CurrencyCode,
  rates: RatesMap,
): number =>
  (convertMinor(s.amount, s.currency, base, rates) *
    frequencyMetaOf(s, 'monthly').perYear) /
  12

/** Streams within this share of the largest are too close to call on converted amounts. */
const NEAR_TIE = 0.1

/** Monthly pay in the stream's own currency, on average. */
const nativeMonthly = (s: LocalIncomeStream): number =>
  (s.amount * frequencyMetaOf(s, 'monthly').perYear) / 12

const byPosition = (a: LocalIncomeStream, b: LocalIncomeStream): number =>
  a.position - b.position || a.id.localeCompare(b.id)

/**
 * The stream that sets the pay periods: the one the user picked, else the largest by monthly
 * amount. None while income varies or no stream is active. Streams within `NEAR_TIE` of the
 * largest (in base) are a near tie, settled without exchange rates so a rate move cannot flip
 * the pay periods: by monthly amount when they share a currency, else by position.
 */
export function mainPaycheckOf(
  income: ReadonlyArray<LocalIncomeStream>,
  settings: Pick<PlanningSettings, 'mainIncomeStreamId' | 'incomeVaries'>,
  base: CurrencyCode,
  rates: RatesMap,
  today: string,
): LocalIncomeStream | null {
  if (settings.incomeVaries) return null
  const active = income.filter((s) => isStreamActive(s, today))
  const picked = active.find((s) => s.id === settings.mainIncomeStreamId)
  if (picked) return picked
  const monthly = new Map(
    active.map((s) => [s.id, monthlyIncomeOf(s, base, rates)]),
  )
  const largest = Math.max(0, ...monthly.values())
  const near = active.filter(
    (s) => (monthly.get(s.id) ?? 0) >= largest * (1 - NEAR_TIE),
  )
  const oneCurrency = new Set(near.map((s) => s.currency)).size === 1
  const ranked = [...near].sort((a, b) =>
    oneCurrency
      ? nativeMonthly(b) - nativeMonthly(a) || byPosition(a, b)
      : byPosition(a, b),
  )
  return ranked[0] ?? null
}

export function payCalendarOf(
  income: ReadonlyArray<LocalIncomeStream>,
  settings: Pick<PlanningSettings, 'mainIncomeStreamId' | 'incomeVaries'>,
  base: CurrencyCode,
  rates: RatesMap,
  today: string,
): PayCalendar {
  const stream = mainPaycheckOf(income, settings, base, rates, today)
  return stream
    ? {
        kind: 'paycheck',
        stream,
        perYear: frequencyMetaOf(stream, 'monthly').perYear,
      }
    : { kind: 'month', perYear: 12 }
}

const firstOfMonth = (iso: string): string => `${iso.slice(0, 7)}-01`

const nextMonthStart = (iso: string): string => {
  const d = dateOf(iso)
  return isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 1))
}

/** Every payday of the calendar from `from` to `to` (inclusive) — the 1sts for months. */
export function paydaysIn(
  cal: PayCalendar,
  from: string,
  to: string,
): string[] {
  if (from > to) return []
  if (cal.kind === 'paycheck') return paydaysOf(cal.stream, from, to)
  const out: string[] = []
  let at = firstOfMonth(from)
  if (at < from) at = nextMonthStart(at)
  while (at <= to) {
    out.push(at)
    at = nextMonthStart(at)
  }
  return out
}

/** The last payday on or before `date`, or null when there is none in reach. */
export const paydayOnOrBefore = (
  cal: PayCalendar,
  date: string,
): string | null =>
  paydaysIn(cal, addDaysISO(date, -SEARCH_DAYS), date).at(-1) ?? null

/** The first payday strictly after `date`, or null when there is none in reach. */
export const paydayAfter = (cal: PayCalendar, date: string): string | null =>
  paydaysIn(cal, addDaysISO(date, 1), addDaysISO(date, SEARCH_DAYS))[0] ?? null

/** The pay period `date` falls in. */
export function periodOf(cal: PayCalendar, date: string): PayPeriod {
  const start = paydayOnOrBefore(cal, date) ?? date
  const next =
    paydayAfter(cal, date) ?? addDaysISO(start, FALLBACK_HORIZON_DAYS)
  return { start, end: addDaysISO(next, -1) }
}

/** Consecutive pay periods, from the one holding `from` to the one holding `to`. */
export function periodsBetween(
  cal: PayCalendar,
  from: string,
  to: string,
): PayPeriod[] {
  const out: PayPeriod[] = []
  let period = periodOf(cal, from)
  while (period.start <= to) {
    out.push(period)
    period = periodOf(cal, addDaysISO(period.end, 1))
  }
  return out
}

/** A monthly amount spread over the calendar's paydays (e.g. weekly pay: × 12 / 52). */
export const perPaycheck = (monthly: number, cal: PayCalendar): number =>
  (monthly * 12) / cal.perYear

/**
 * Income the streams bring in from `from` to `to` (inclusive), base minor units. A stream
 * pays nothing after its `endsOn`.
 */
export function incomeBetween(
  income: ReadonlyArray<LocalIncomeStream>,
  from: string,
  to: string,
  base: CurrencyCode,
  rates: RatesMap,
): number {
  let total = 0
  for (const s of income) {
    if (s.deleted !== 0) continue
    const until = s.endsOn !== null && s.endsOn < to ? s.endsOn : to
    const count = paydaysOf(s, from, until).length
    total += count * convertMinor(s.amount, s.currency, base, rates)
  }
  return total
}

/**
 * The last day Safe to spend looks ahead to (inclusive). "Until payday" is the day before the
 * next main payday; with no reliable payday (no income, or income that varies) it is 30 days.
 */
export function safeHorizonEnd(
  settings: Pick<PlanningSettings, 'safeHorizon' | 'safeHorizonDays'>,
  cal: PayCalendar,
  today: string,
): string {
  if (settings.safeHorizon === 'end_of_month')
    return addDaysISO(nextMonthStart(today), -1)
  if (settings.safeHorizon === 'days')
    return addDaysISO(today, settings.safeHorizonDays ?? FALLBACK_HORIZON_DAYS)
  const next = cal.kind === 'paycheck' ? paydayAfter(cal, today) : null
  return next ? addDaysISO(next, -1) : addDaysISO(today, FALLBACK_HORIZON_DAYS)
}
