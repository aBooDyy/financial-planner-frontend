import { addDays, fmtK, ymd } from '#/features/transactions/data/planning'
import { formatMoneyRounded, toMajor, toMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { BalanceAt } from './balances'
import { granularityOf } from './buckets'
import type { Bucket } from './buckets'
import { balanceMoney, signedMoney } from './delta'
import { sumOf } from './flowRows'
import type { FlowRow } from './flowRows'
import type { ReportRange } from './range'

/** The figures above the chart: the whole period, or the column being pointed at. */
export type Readout = {
  /** "So far", "Whole period", or the column's title. */
  title: string
  incomeStr: string
  spendingStr: string
  netStr: string
  netPositive: boolean
  /**
   * The balance going into the column and coming out of it; null for the whole period, which
   * has the balance strip for that.
   */
  balance: { startStr: string; endStr: string } | null
}

export type TrendColumn = {
  key: string
  label: string
  future: boolean
  /** Heights against the axis top, 0–100. */
  incomePct: number
  spendingPct: number
  /** Null for a column still in the future. */
  readout: Readout | null
}

export type GridLine = { label: string; pct: number }

export type TrendView = {
  sub: string
  columns: TrendColumn[]
  grid: GridLine[]
  whole: Readout
}

const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

/** A round axis top at or above `v`: 1,200 → 1,200, 1,300 → 1,500. */
export function niceMax(v: number): number {
  if (v <= 0) return 100
  const p = 10 ** Math.floor(Math.log10(v))
  return (STEPS.find((m) => m * p >= v) ?? 10) * p
}

function readoutOf(
  title: string,
  rows: ReadonlyArray<FlowRow>,
  balance: Readout['balance'],
  base: CurrencyCode,
): Readout {
  const income = sumOf(rows, 'income')
  const spending = sumOf(rows, 'spend')
  return {
    title,
    incomeStr: formatMoneyRounded(income, base),
    spendingStr: formatMoneyRounded(spending, base),
    netStr: signedMoney(income - spending, base),
    netPositive: income >= spending,
    balance,
  }
}

/** Income beside spending for each day, week or month of the period. */
export function buildTrend(
  cur: ReadonlyArray<FlowRow>,
  buckets: ReadonlyArray<Bucket>,
  range: ReportRange,
  balance: BalanceAt,
  base: CurrencyCode,
): TrendView {
  const dataEnd = ymd(range.dataEnd)
  const sums = buckets.map((b) => {
    const from = ymd(b.start)
    const to = ymd(b.end)
    const rows = cur.filter((r) => r.date >= from && r.date <= to)
    return {
      rows,
      income: sumOf(rows, 'income'),
      spending: sumOf(rows, 'spend'),
    }
  })
  const peak = Math.max(0, ...sums.flatMap((s) => [s.income, s.spending]))
  const top = toMinor(niceMax(toMajor(peak, base)), base)
  const pct = (v: number) => (v / top) * 100

  const granularity = granularityOf(range)
  const hasFuture = buckets.some((b) => b.future)
  return {
    sub: `By ${granularity}${hasFuture ? ` · remaining ${granularity}s shown empty` : ''}`,
    columns: buckets.map((b, i) => {
      const s = sums[i]
      const through = ymd(b.end) < dataEnd ? ymd(b.end) : dataEnd
      return {
        key: ymd(b.start),
        label: b.label,
        future: b.future,
        incomePct: pct(s.income),
        spendingPct: pct(s.spending),
        readout: b.future
          ? null
          : readoutOf(
              b.title,
              s.rows,
              {
                startStr: balanceMoney(
                  balance(ymd(addDays(b.start, -1))),
                  base,
                ),
                endStr: balanceMoney(balance(through), base),
              },
              base,
            ),
      }
    }),
    grid: [1, 0.5, 0].map((f) => ({
      label: fmtK(top * f, base),
      pct: f * 100,
    })),
    whole: readoutOf(
      range.partial ? 'So far' : 'Whole period',
      cur,
      null,
      base,
    ),
  }
}
