import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { addDaysISO } from './dates'
import type { PlannedRowView } from './views'

/** How far the Planned tab's rail looks ahead. */
export const OUTLOOK_DAYS = 30

/**
 * Open rows with something left to settle, due by the end of the window. Anything already
 * due stays in: it hasn't been confirmed, but it's owed.
 */
export function outlookRows(
  rows: ReadonlyArray<PlannedRowView>,
  today: string,
): PlannedRowView[] {
  const until = addDaysISO(today, OUTLOOK_DAYS)
  return rows.filter((r) => r.remainder > 0 && r.item.date <= until)
}

export const remainderInBase = (
  row: PlannedRowView,
  base: CurrencyCode,
  rates: RatesMap,
): number => convertMinor(row.remainder, row.currency, base, rates)
