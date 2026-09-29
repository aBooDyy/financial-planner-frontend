import type { IsoSpan } from '#/features/transactions/data/customRange'
import {
  addDays,
  daysIn,
  fmtShort,
  parseISO,
  ymd,
} from '#/features/transactions/data/planning'

export const RANGE_PRESETS = [
  'this_month',
  'last_month',
  'last_3',
  'last_6',
  'ytd',
  'last_12',
  'last_year',
  'custom',
] as const

export type RangePreset = (typeof RANGE_PRESETS)[number]

export const isRangePreset = (value: unknown): value is RangePreset =>
  (RANGE_PRESETS as readonly unknown[]).includes(value)

export const COMPARISONS = ['prev', 'yoy', 'none'] as const

export type Comparison = (typeof COMPARISONS)[number]

export const isComparison = (value: unknown): value is Comparison =>
  (COMPARISONS as readonly unknown[]).includes(value)

export const COMPARISON_LABEL: Record<Comparison, string> = {
  prev: 'vs previous period',
  yoy: 'vs same period last year',
  none: 'No comparison',
}

export const DEFAULT_PRESET: RangePreset = 'last_6'
export const DEFAULT_COMPARISON: Comparison = 'prev'

export function presetLabel(preset: RangePreset, today: Date): string {
  switch (preset) {
    case 'this_month':
      return 'This month'
    case 'last_month':
      return 'Last month'
    case 'last_3':
      return 'Last 3 months'
    case 'last_6':
      return 'Last 6 months'
    case 'ytd':
      return 'Year to date'
    case 'last_12':
      return 'Last 12 months'
    case 'last_year':
      return `Last year (${today.getFullYear() - 1})`
    case 'custom':
      return 'Custom range'
  }
}

/** A stretch of days: `end` is where the period ends, `dataEnd` where its data stops. */
export type ReportWindow = {
  start: Date
  end: Date
  /** `end`, or today when the period is still running. */
  dataEnd: Date
}

export type ReportRange = ReportWindow & {
  /** The period runs past today, so its figures are "so far". */
  partial: boolean
  /** "Apr 1 – Sep 29, 2026 · so far". */
  caption: string
  /** The same number of days earlier, or null with no comparison. */
  compare: (ReportWindow & { caption: string }) | null
}

/** How far the comparison steps back: whole months keep month ends on month ends. */
type Shift = { months: number } | { days: number }

const daysInMonth = (y: number, m: number): number =>
  new Date(y, m + 1, 0).getDate()

/** `d` moved by whole months; a month's last day stays the last day of its new month. */
export function shiftMonths(d: Date, months: number): Date {
  const isLastDay = d.getDate() === daysInMonth(d.getFullYear(), d.getMonth())
  const first = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = daysInMonth(first.getFullYear(), first.getMonth())
  return new Date(
    first.getFullYear(),
    first.getMonth(),
    isLastDay ? last : Math.min(d.getDate(), last),
  )
}

const back = (d: Date, shift: Shift): Date =>
  'months' in shift ? shiftMonths(d, -shift.months) : addDays(d, -shift.days)

/** "Jun 3, 2026", "Jun 3 – 14, 2026", "Jun 3 – Jul 14, 2026", or with both years. */
export function spanCaption(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear()
  if (+start === +end) return `${fmtShort(start)}, ${start.getFullYear()}`
  if (sameYear && start.getMonth() === end.getMonth())
    return `${fmtShort(start)} – ${end.getDate()}, ${end.getFullYear()}`
  if (sameYear)
    return `${fmtShort(start)} – ${fmtShort(end)}, ${end.getFullYear()}`
  return `${fmtShort(start)}, ${start.getFullYear()} – ${fmtShort(end)}, ${end.getFullYear()}`
}

function presetWindow(
  preset: RangePreset,
  custom: IsoSpan,
  today: Date,
): { start: Date; end: Date; shift: Shift } {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (preset) {
    case 'this_month':
      return {
        start: new Date(y, m, 1),
        end: new Date(y, m + 1, 0),
        shift: { months: 1 },
      }
    case 'last_month':
      return {
        start: new Date(y, m - 1, 1),
        end: new Date(y, m, 0),
        shift: { months: 1 },
      }
    case 'last_3':
    case 'last_6':
    case 'last_12': {
      const k = preset === 'last_3' ? 3 : preset === 'last_6' ? 6 : 12
      return {
        start: new Date(y, m - k + 1, 1),
        end: new Date(y, m + 1, 0),
        shift: { months: k },
      }
    }
    case 'ytd':
      return { start: new Date(y, 0, 1), end: today, shift: { months: 12 } }
    case 'last_year':
      return {
        start: new Date(y - 1, 0, 1),
        end: new Date(y - 1, 11, 31),
        shift: { months: 12 },
      }
    case 'custom': {
      const a = parseISO(custom.start)
      const b = parseISO(custom.end)
      const [start, end] = a <= b ? [a, b] : [b, a]
      return { start, end, shift: { days: daysIn({ start, end }) } }
    }
  }
}

/**
 * The period a preset names relative to `today`, and the stretch it is compared with: the
 * one just before it, or the same dates a year earlier. A running period is compared only up
 * to the same point — the same day of the month, or the same day count for a custom span — so
 * "so far" is never set against a whole period.
 */
export function reportRange(
  preset: RangePreset,
  custom: IsoSpan,
  comparison: Comparison,
  today: Date,
): ReportRange {
  const { start, end, shift } = presetWindow(preset, custom, today)
  const partial = end > today
  // A span that hasn't begun has nothing so far; its first day keeps the window forward.
  const dataEnd = partial ? (start > today ? start : today) : end
  const caption = `${spanCaption(start, dataEnd)}${partial ? ' · so far' : ''}`
  if (comparison === 'none')
    return { start, end, dataEnd, partial, caption, compare: null }

  const step: Shift = comparison === 'yoy' ? { months: 12 } : shift
  const cStart = back(start, step)
  const cDataEnd = back(dataEnd, step)
  return {
    start,
    end,
    dataEnd,
    partial,
    caption,
    compare: {
      start: cStart,
      end: back(end, step),
      dataEnd: cDataEnd,
      caption: spanCaption(cStart, cDataEnd),
    },
  }
}

/** The dates a report reads rows for: its own period and the comparison's. */
export const readSpans = (range: ReportRange): [string, string][] => [
  [ymd(range.start), ymd(range.dataEnd)],
  ...(range.compare
    ? [
        [ymd(range.compare.start), ymd(range.compare.dataEnd)] as [
          string,
          string,
        ],
      ]
    : []),
]
