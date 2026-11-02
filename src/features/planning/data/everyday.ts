/**
 * Everyday spending: category budgets counted in the plan, like groceries or fuel. The amount is
 * an estimate, so nothing is set aside and no upcoming rows are made; the plan only leaves room
 * for it in each paycheck. Pure.
 */
import type { LocalBudget, LocalTransaction } from '#/db/types'
import { addMonthsISO } from '#/features/planned/data/dates'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import type { PayCalendar } from './payPeriods'

export type EverydayItem = {
  budgetId: string
  categoryId: string
  /** The estimate per budget period, in `currency`. */
  limit: number
  currency: CurrencyCode
  /** What it takes from each slot, base minor units. */
  perSlot: number
}

type Cadence = Pick<LocalBudget, 'period' | 'customDays'>

const DAYS_PER_YEAR = 365.25
/** A custom budget saved without a length. */
const DEFAULT_CUSTOM_DAYS = 30
/** How far back the spending average looks. */
export const AVERAGE_MONTHS = 3

export const isPlannedBudget = (
  b: Pick<LocalBudget, 'inPlan' | 'scopeType' | 'limit' | 'deleted'>,
): boolean =>
  b.deleted === 0 && b.inPlan === true && b.scopeType === 'category' && b.limit > 0

function periodsPerYear(b: Cadence, cal: PayCalendar): number {
  switch (b.period) {
    case 'weekly':
      return DAYS_PER_YEAR / 7
    case 'monthly':
      return 12
    case 'paycheck':
      return cal.perYear
    case 'custom':
      return DAYS_PER_YEAR / (b.customDays ?? DEFAULT_CUSTOM_DAYS)
  }
}

/** An amount per budget period as an amount per pay period. */
export const perSlotOf = (
  amount: number,
  b: Cadence,
  cal: PayCalendar,
): number => (amount * periodsPerYear(b, cal)) / cal.perYear

/** A monthly amount as an amount per budget period. */
export const perBudgetPeriodOf = (
  monthly: number,
  b: Cadence,
  cal: PayCalendar,
): number => (monthly * 12) / periodsPerYear(b, cal)

export const everydayItems = (
  budgets: ReadonlyArray<LocalBudget>,
  cal: PayCalendar,
  base: CurrencyCode,
  rates: RatesMap,
): EverydayItem[] =>
  budgets.filter(isPlannedBudget).map((b) => ({
    budgetId: b.id,
    categoryId: b.categoryId ?? '',
    limit: b.limit,
    currency: b.currency,
    perSlot: perSlotOf(convertMinor(b.limit, b.currency, base, rates), b, cal),
  }))

export const everydayTotal = (items: ReadonlyArray<EverydayItem>): number =>
  items.reduce((sum, i) => sum + i.perSlot, 0)

/**
 * The first day of the months the spending average reads, and the last day. This month is left
 * out because it isn't over.
 */
export const averageWindow = (today: string): { from: string; to: string } => {
  const thisMonth = `${today.slice(0, 7)}-01`
  return { from: addMonthsISO(thisMonth, -AVERAGE_MONTHS), to: thisMonth }
}

/**
 * What a month has cost lately, for one root category: over the recent months that have any such
 * spending, leaving out bill payments. Null with no history to go on.
 */
export function averageMonthlySpend(args: {
  txns: ReadonlyArray<LocalTransaction>
  rootOf: (categoryId: string) => string
  rootId: string
  currency: CurrencyCode
  rates: RatesMap
  today: string
}): number | null {
  const { from, to } = averageWindow(args.today)
  const months = new Set<string>()
  let sum = 0
  for (const t of args.txns) {
    if (t.deleted || t.type !== 'spend' || t.billId || !t.categoryId) continue
    if (t.date < from || t.date >= to) continue
    if (args.rootOf(t.categoryId) !== args.rootId) continue
    months.add(t.date.slice(0, 7))
    sum += convertMinor(t.amount, t.currency, args.currency, args.rates)
  }
  return months.size > 0 ? sum / months.size : null
}
