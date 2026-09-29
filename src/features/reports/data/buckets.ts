import {
  addDays,
  daysIn,
  fmtMonth,
  fmtMonthShort,
  fmtShort,
} from '#/features/transactions/data/planning'
import { spanCaption } from './range'
import type { ReportWindow } from './range'

export type Granularity = 'day' | 'week' | 'month'

/** One column of the trend chart. */
export type Bucket = {
  start: Date
  end: Date
  /** "Mon", "Jun 3", "Jan '26". */
  label: string
  /** "Monday, Jun 3", "Jun 3 – 9, 2026", "June 2026 · so far". */
  title: string
  /** Starts after today: drawn empty. */
  future: boolean
}

/** A week or less reads by day, up to about a quarter by week, anything longer by month. */
export function granularityOf(
  win: Pick<ReportWindow, 'start' | 'end'>,
): Granularity {
  const days = daysIn(win)
  return days <= 8 ? 'day' : days <= 100 ? 'week' : 'month'
}

const minDate = (a: Date, b: Date): Date => (a < b ? a : b)

function dayBuckets(win: ReportWindow, today: Date): Bucket[] {
  return Array.from({ length: daysIn(win) }, (_, i) => {
    const d = addDays(win.start, i)
    return {
      start: d,
      end: d,
      label: d.toLocaleString('en-US', { weekday: 'short' }),
      title: d.toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
      future: d > today,
    }
  })
}

function weekBuckets(win: ReportWindow, today: Date): Bucket[] {
  const out: Bucket[] = []
  for (let a = win.start; a <= win.end; a = addDays(a, 7)) {
    const b = minDate(addDays(a, 6), win.end)
    out.push({
      start: a,
      end: b,
      label: fmtShort(a),
      title: spanCaption(a, b),
      future: a > today,
    })
  }
  return out
}

function monthBuckets(win: ReportWindow, today: Date): Bucket[] {
  const spansYears = win.start.getFullYear() !== win.end.getFullYear()
  const out: Bucket[] = []
  for (
    let m = new Date(win.start.getFullYear(), win.start.getMonth(), 1);
    m <= win.end;
    m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
  ) {
    const start = m < win.start ? win.start : m
    const end = minDate(new Date(m.getFullYear(), m.getMonth() + 1, 0), win.end)
    const year = spansYears && (m.getMonth() === 0 || out.length === 0)
    const running = start <= today && end > today
    out.push({
      start,
      end,
      label: `${fmtMonthShort(m)}${year ? ` '${String(m.getFullYear()).slice(2)}` : ''}`,
      title: `${fmtMonth(m)}${running ? ' · so far' : ''}`,
      future: start > today,
    })
  }
  return out
}

/** The trend chart's columns across the whole period, future ones included. */
export function bucketsOf(win: ReportWindow, today: Date): Bucket[] {
  const g = granularityOf(win)
  if (g === 'day') return dayBuckets(win, today)
  if (g === 'week') return weekBuckets(win, today)
  return monthBuckets(win, today)
}
