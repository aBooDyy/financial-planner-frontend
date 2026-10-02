/**
 * Settings › Preferences › Planning (05): the choices' words and the small sums behind them.
 * Pure.
 */
import type { LocalTransaction } from '#/db/types'
import type { PaydayMode, SafeHorizon } from '#/features/wallets/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'

/** The Planning card's anchor on Settings › Preferences, so other pages can link to it. */
export const PLANNING_PREFS_ID = 'planning'

export const HORIZON_OPTIONS: ReadonlyArray<{
  value: SafeHorizon
  label: string
}> = [
  { value: 'until_payday', label: 'Until next payday' },
  { value: 'end_of_month', label: 'End of this month' },
  { value: 'days', label: 'Next N days' },
]

export const PAYDAY_MODE_OPTIONS: ReadonlyArray<{
  value: PaydayMode
  label: string
}> = [
  { value: 'review', label: 'Review what to set aside' },
  { value: 'auto', label: 'Set aside automatically' },
]

/** The window a fresh "Next N days" choice starts on. */
export const DEFAULT_HORIZON_DAYS = 14

export const VARIES_EXPLAINER =
  'For freelancers, commission or seasonal work. We’ll plan with a safe minimum and keep next month’s bills ready ahead of time.'

/** A typed day count, held to the server's bounds; null when it isn't a number. */
export function clampHorizonDays(
  text: string,
  min: number,
  max: number,
): number | null {
  const n = Math.round(Number(text.trim()))
  if (text.trim() === '' || !Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, n))
}

const monthOf = (iso: string) => iso.slice(0, 7)

const INCOME_LOOKBACK_MONTHS = 6

/** The first day `lowestMonthlyIncome` looks at: the 1st, six months before this one. */
export function incomeLookbackStart(today: string): string {
  const [y, m] = today.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 - INCOME_LOOKBACK_MONTHS, 1))
    .toISOString()
    .slice(0, 10)
}

/**
 * The lowest month of income among the last six full calendar months that had any, in base
 * currency — what "Plan with at least" starts from (05 §3). Null with no income in that time.
 */
export function lowestMonthlyIncome(
  rows: ReadonlyArray<
    Pick<LocalTransaction, 'type' | 'amount' | 'currency' | 'date' | 'deleted'>
  >,
  today: string,
  base: CurrencyCode,
  rates: RatesMap,
): number | null {
  const [y, m] = today.split('-').map(Number)
  const months = new Set<string>()
  for (let back = 1; back <= INCOME_LOOKBACK_MONTHS; back++) {
    const d = new Date(Date.UTC(y, m - 1 - back, 1))
    months.add(d.toISOString().slice(0, 7))
  }
  const totals = new Map<string, number>()
  for (const t of rows) {
    if (t.deleted !== 0 || t.type !== 'income') continue
    const month = monthOf(t.date)
    if (!months.has(month)) continue
    totals.set(
      month,
      (totals.get(month) ?? 0) +
        convertMinor(t.amount, t.currency, base, rates),
    )
  }
  return totals.size === 0 ? null : Math.min(...totals.values())
}
