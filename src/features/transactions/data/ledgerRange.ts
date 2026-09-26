import type { LocalBudget } from '#/db/types'
import type { RangeMode } from '#/features/transactions/constants'
import { budgetWindow, windowOf, ymd } from './planning'
import type { DateWindow } from './planning'
import { calendarSpan } from './selectors'

/** An inclusive span of ISO `YYYY-MM-DD` dates — the shape the `date` index is queried by. */
export type IsoRange = readonly [from: string, to: string]

/** Sorted, with overlapping spans joined, so no row is read twice. */
export function mergeRanges(ranges: ReadonlyArray<IsoRange>): IsoRange[] {
  const sorted = [...ranges].sort((a, b) => a[0].localeCompare(b[0]))
  const out: [string, string][] = []
  for (const [from, to] of sorted) {
    const last = out.at(-1)
    if (last && from <= last[1]) {
      if (to > last[1]) last[1] = to
    } else out.push([from, to])
  }
  return out
}

/**
 * Every date the Spending selectors can read a transaction on: the period on screen, all the
 * calendar shows around it, and each live budget's window — which runs to today whatever
 * period is on screen.
 */
export function ledgerRanges(
  anchor: Date,
  mode: RangeMode,
  today: Date,
  budgets: ReadonlyArray<LocalBudget>,
): IsoRange[] {
  const windows: DateWindow[] = [
    windowOf(anchor, mode),
    calendarSpan(anchor, mode),
    ...budgets
      .filter((b) => b.deleted === 0)
      .map((b) => budgetWindow(b.period, b.customDays, today)),
  ]
  return mergeRanges(windows.map((w) => [ymd(w.start), ymd(w.end)]))
}
