import type { LocalTransaction } from '#/db/types'
import { isCashflow } from '#/features/transactions/api/types'
import type { RatesMap } from '#/lib/config/rates'
import {
  convertMinor,
  formatMoneyCompact,
  formatMoneyRounded,
} from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

export const FLOW_MONTHS = 6

export type MonthFlow = {
  /** `YYYY-MM`. */
  key: string
  /** "Sep". */
  label: string
  /** "September so far" for the running month, else "May 2026". */
  title: string
  isCurrent: boolean
  inStr: string
  outStr: string
  /** Signed: "+SR 1,200" / "−SR 300". */
  netStr: string
  netPositive: boolean
  /** Heights against the tallest bar in the window, 0–100. */
  inPct: number
  outPct: number
  /** "May 2026: in SR 8,000, out SR 5,200, net +SR 2,800". */
  ariaLabel: string
}

export type MonthlyFlowView = {
  months: MonthFlow[]
  /** The tallest bar's value, compact — the one scale reading the chart shows. */
  scaleStr: string
  hasData: boolean
}

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)
const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

const monthsEndingAt = (today: Date, count: number): Date[] =>
  Array.from(
    { length: count },
    (_, i) =>
      new Date(today.getFullYear(), today.getMonth() - (count - 1 - i), 1),
  )

/** The first day (ISO) of the oldest month the chart shows. */
export const flowWindowStart = (today: Date): string =>
  `${monthKey(monthsEndingAt(today, FLOW_MONTHS)[0])}-01`

/**
 * Money in and out per calendar month, in base currency, for the last six months (the
 * running one included). Only income and spending count — transfers and balance adjustments
 * move money between the user's own places, they don't earn or spend it.
 */
export function buildMonthlyFlow(
  rows: ReadonlyArray<LocalTransaction>,
  base: CurrencyCode,
  rates: RatesMap,
  today: Date,
): MonthlyFlowView {
  const starts = monthsEndingAt(today, FLOW_MONTHS)
  const totals = new Map(starts.map((d) => [monthKey(d), { in: 0, out: 0 }]))

  for (const t of rows) {
    if (t.deleted !== 0 || !isCashflow(t.type) || t.categoryId === null)
      continue
    const bucket = totals.get(t.date.slice(0, 7))
    if (!bucket) continue
    const value = convertMinor(t.amount, t.currency, base, rates)
    if (t.type === 'income') bucket.in += value
    else bucket.out += value
  }

  const peak = Math.max(
    0,
    ...[...totals.values()].flatMap((m) => [m.in, m.out]),
  )
  const pctOf = (v: number) => (peak > 0 ? (v / peak) * 100 : 0)
  const current = monthKey(today)

  const months = starts.map((d): MonthFlow => {
    const key = monthKey(d)
    const { in: inflow, out } = totals.get(key) ?? { in: 0, out: 0 }
    const net = inflow - out
    const isCurrent = key === current
    const long = d.toLocaleString('en-US', { month: 'long' })
    const title = isCurrent ? `${long} so far` : `${long} ${d.getFullYear()}`
    const inStr = formatMoneyRounded(inflow, base)
    const outStr = formatMoneyRounded(out, base)
    const netStr = `${net >= 0 ? '+' : '−'}${formatMoneyRounded(Math.abs(net), base)}`
    return {
      key,
      label: d.toLocaleString('en-US', { month: 'short' }),
      title,
      isCurrent,
      inStr,
      outStr,
      netStr,
      netPositive: net >= 0,
      inPct: pctOf(inflow),
      outPct: pctOf(out),
      ariaLabel: `${title}: in ${inStr}, out ${outStr}, net ${netStr}`,
    }
  })

  return {
    months,
    scaleStr: formatMoneyCompact(peak, base),
    hasData: peak > 0,
  }
}
