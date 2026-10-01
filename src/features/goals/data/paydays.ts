/**
 * When an income stream pays. Pure and clock-free, and deterministic across devices: every
 * date comes from the stream's own fields, never from when a row was created or synced.
 *
 * - **Monthly** pays on `day` every month, clamped to short months (31st → Sep 30).
 * - **With an anchor** (a known payday), weekly steps 7 days and quarterly / semi-annual /
 *   annual step whole months from it, in both directions; a stepped month keeps the anchor's
 *   day, clamped.
 * - **Without one**, weekly steps from `day` of January 2000 and the longer cadences fall in
 *   the calendar months divisible by their length (quarterly: Jan / Apr / Jul / Oct).
 * - **Custom** ("every N days / weeks / months") steps from the anchor, or from `day` of
 *   January 2000 without one; a month step keeps the anchor's day, clamped.
 */
import type {
  GoalFrequency,
  IntervalUnit,
  ObligationFrequency,
} from '#/features/goals/api/types'
import { FREQUENCIES } from '#/features/goals/constants'
import { parseISO, ymd } from './planning'

export type PaySchedule = {
  day: number
  frequency: ObligationFrequency
  anchorDate?: string | null
  /** Read only for a custom frequency. */
  customInterval?: number | null
  customUnit?: IntervalUnit | null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Whether a stream's dates come from a chosen payday rather than a day of the month. */
export const usesPaydayAnchor = (frequency: ObligationFrequency): boolean =>
  frequency !== 'monthly'

const cycleMonths = (frequency: GoalFrequency): number =>
  Math.max(1, Math.round(12 / FREQUENCIES[frequency].perYear))

const validAnchor = (anchor: string | null | undefined): string | null =>
  anchor && ISO_DATE.test(anchor) ? anchor : null

const monthIndexOf = (iso: string): number =>
  Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1

const clampDay = (day: number): number => Math.max(1, Math.min(31, day || 1))

/** `day` of the absolute month `index` (year × 12 + month), clamped to its length. */
const onDay = (index: number, day: number): string => {
  const year = Math.floor(index / 12)
  const month = index - year * 12
  const last = new Date(year, month + 1, 0).getDate()
  return ymd(new Date(year, month, Math.min(clampDay(day), last)))
}

const addDays = (iso: string, days: number): string => {
  const d = parseISO(iso, new Date())
  return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

const daysFrom = (a: string, b: string): number => {
  const fallback = new Date()
  return Math.round(
    (parseISO(b, fallback).getTime() - parseISO(a, fallback).getTime()) /
      86_400_000,
  )
}

function everyDays(
  anchor: string,
  step: number,
  from: string,
  to: string,
): string[] {
  const out: string[] = []
  let at = addDays(anchor, Math.ceil(daysFrom(anchor, from) / step) * step)
  while (at < from) at = addDays(at, step)
  while (at <= to) {
    out.push(at)
    at = addDays(at, step)
  }
  return out
}

function monthlyPaydays(
  phase: number,
  step: number,
  day: number,
  from: string,
  to: string,
): string[] {
  const out: string[] = []
  for (let m = monthIndexOf(from); m <= monthIndexOf(to); m++) {
    if ((((m - phase) % step) + step) % step !== 0) continue
    const at = onDay(m, day)
    if (at >= from && at <= to) out.push(at)
  }
  return out
}

function customPaydays(
  stream: PaySchedule,
  anchor: string,
  from: string,
  to: string,
): string[] {
  const every = Math.max(1, Math.round(stream.customInterval ?? 1))
  if (stream.customUnit === 'month')
    return monthlyPaydays(
      monthIndexOf(anchor),
      every,
      Number(anchor.slice(8, 10)),
      from,
      to,
    )
  const days = stream.customUnit === 'week' ? every * 7 : every
  return everyDays(anchor, days, from, to)
}

/** Every payday of the stream from `from` to `to` (ISO dates, both inclusive). */
export function paydaysOf(
  stream: PaySchedule,
  from: string,
  to: string,
): string[] {
  if (from > to) return []
  const anchor = usesPaydayAnchor(stream.frequency)
    ? validAnchor(stream.anchorDate)
    : null
  const epoch = onDay(2000 * 12, stream.day)
  if (stream.frequency === 'custom')
    return customPaydays(stream, anchor ?? epoch, from, to)
  if (stream.frequency === 'weekly')
    return everyDays(anchor ?? epoch, 7, from, to)
  const step = cycleMonths(stream.frequency)
  if (!anchor) return monthlyPaydays(0, step, stream.day, from, to)
  return monthlyPaydays(
    monthIndexOf(anchor),
    step,
    Number(anchor.slice(8, 10)),
    from,
    to,
  )
}

/** A year and a bit: every cadence pays at least once in it. */
const NEXT_WINDOW_DAYS = 400

/** The stream's first payday on or after `today`. */
export function nextPaydayOf(stream: PaySchedule, today: Date): Date {
  const from = ymd(today)
  const paydays = paydaysOf(stream, from, addDays(from, NEXT_WINDOW_DAYS))
  return paydays.length > 0 ? parseISO(paydays[0], today) : today
}
