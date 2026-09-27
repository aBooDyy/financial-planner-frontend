/**
 * The Planned tab's "Where it's headed": the income planned over the window against what the
 * plans already claim — payments and goal set-asides — and what is left unclaimed.
 */
import type { BarSegment } from '#/components/SegmentedBar'
import { formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { formatShare } from '#/lib/percent'
import { outlookRows, remainderInBase } from './outlook'
import type { PlannedRowView } from './views'

export type HeadedKey = 'payments' | 'set_asides' | 'unplanned'

export const HEADED_COLOR: Record<HeadedKey, string> = {
  payments: 'var(--fp-chart-out)',
  set_asides: 'var(--fp-chart-set-aside)',
  unplanned: 'var(--fp-chart-in)',
}

const LABEL: Record<HeadedKey, string> = {
  payments: 'Payments',
  set_asides: 'Set-asides',
  unplanned: 'Not planned yet',
}

export type HeadedLine = {
  key: HeadedKey
  label: string
  color: string
  valueStr: string
}

export type HeadedView = {
  inStr: string
  segments: BarSegment[]
  /** The bar's legend, in the bar's order. */
  lines: HeadedLine[]
  /** What income leaves once every plan is met, or how far plans overshoot it. */
  leftover: { kind: 'spare' | 'even' | 'over'; valueStr: string; text: string }
  isEmpty: boolean
}

export type HeadedInput = {
  rows: ReadonlyArray<PlannedRowView>
  base: CurrencyCode
  rates: RatesMap
  today: string
}

function leftoverOf(
  income: number,
  claimed: number,
  base: CurrencyCode,
): HeadedView['leftover'] {
  const valueStr = formatMoneyRounded(Math.abs(income - claimed), base)
  if (income > claimed)
    return { kind: 'spare', valueStr, text: 'of what comes in has no plan yet' }
  if (income < claimed)
    return { kind: 'over', valueStr, text: 'more planned than comes in' }
  return { kind: 'even', valueStr: '', text: 'Every bit coming in is planned' }
}

export function buildHeaded(input: HeadedInput): HeadedView {
  const { base, rates } = input
  const totals: Record<'income' | 'payments' | 'set_asides', number> = {
    income: 0,
    payments: 0,
    set_asides: 0,
  }
  const rows = outlookRows(input.rows, input.today)
  for (const row of rows) {
    const key =
      row.item.role === 'income'
        ? 'income'
        : row.item.role === 'set_aside'
          ? 'set_asides'
          : 'payments'
    totals[key] += remainderInBase(row, base, rates)
  }

  const claimed = totals.payments + totals.set_asides
  const amounts: Record<HeadedKey, number> = {
    payments: totals.payments,
    set_asides: totals.set_asides,
    unplanned: Math.max(0, totals.income - claimed),
  }
  const whole = Math.max(totals.income, claimed, 1)
  const shareOf = totals.income > 0 ? 'of income' : 'of plans'
  const keys = (Object.keys(amounts) as HeadedKey[]).filter(
    (k) => amounts[k] > 0,
  )

  return {
    inStr: formatMoneyRounded(totals.income, base),
    segments: keys.map((key) => {
      const pct = (amounts[key] / whole) * 100
      return {
        key,
        label: LABEL[key],
        color: HEADED_COLOR[key],
        pct,
        valueStr: formatMoneyRounded(amounts[key], base),
        pctStr: `${formatShare(pct)} ${shareOf}`,
      }
    }),
    lines: keys.map((key) => ({
      key,
      label: LABEL[key],
      color: HEADED_COLOR[key],
      valueStr: formatMoneyRounded(amounts[key], base),
    })),
    leftover: leftoverOf(totals.income, claimed, base),
    isEmpty: rows.length === 0,
  }
}
