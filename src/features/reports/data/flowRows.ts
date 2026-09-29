import type { LocalTransaction } from '#/db/types'
import { isCashflow } from '#/features/transactions/api/types'
import type { TxType } from '#/features/transactions/api/types'
import { ymd } from '#/features/transactions/data/planning'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { ReportWindow } from './range'

/** A spend or income row in scope, its amount already in the base currency. */
export type FlowRow = {
  id: string
  /** ISO `YYYY-MM-DD`. */
  date: string
  type: TxType
  /** The leaf the row was filed under. */
  categoryId: string
  amount: number
  merchantId: string | null
  note: string | null
}

/**
 * The rows a report totals: live income and spending in the chosen accounts. Transfers and
 * balance adjustments move money between the user's own places, so they never count.
 */
export function flowRowsOf(
  rows: ReadonlyArray<LocalTransaction>,
  inScope: (walletId: string) => boolean,
  base: CurrencyCode,
  rates: RatesMap,
): FlowRow[] {
  const out: FlowRow[] = []
  for (const t of rows) {
    if (t.deleted !== 0 || !isCashflow(t.type) || t.categoryId === null)
      continue
    if (!inScope(t.walletId)) continue
    out.push({
      id: t.id,
      date: t.date,
      type: t.type,
      categoryId: t.categoryId,
      amount: convertMinor(t.amount, t.currency, base, rates),
      merchantId: t.merchantId,
      note: t.note,
    })
  }
  return out
}

/** The rows dated from `start` through `dataEnd`, both included. */
export function rowsIn<T extends { date: string }>(
  rows: ReadonlyArray<T>,
  win: Pick<ReportWindow, 'start' | 'dataEnd'>,
): T[] {
  const from = ymd(win.start)
  const to = ymd(win.dataEnd)
  return rows.filter((r) => r.date >= from && r.date <= to)
}

export const sumOf = (rows: ReadonlyArray<FlowRow>, type: TxType): number =>
  rows.reduce((sum, r) => sum + (r.type === type ? r.amount : 0), 0)
