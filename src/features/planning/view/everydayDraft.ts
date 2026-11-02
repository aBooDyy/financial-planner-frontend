/**
 * Everyday spending's editor and row: what the form holds, what blocks saving, the preview line
 * and what a save writes, then how a row reads. Pure.
 */
import type { LocalBudget } from '#/db/types'
import type { BudgetPeriod } from '#/features/transactions/api/types'
import type { BudgetDraft } from '#/features/transactions/data/mutations'
import { perBudgetPeriodOf, perSlotOf } from '#/features/planning/data/everyday'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import { convertMinor, minorToInputValue, parseAmountToMinor, toMajor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { money, perPeriod } from './format'
import type { Chip } from './itemCopy'

export type EverydayForm = {
  categoryId: string
  /** As typed. */
  amount: string
  currency: CurrencyCode
  period: BudgetPeriod
  /** As typed; read only for `custom`. */
  customDays: string
}

/** Spent this share of the estimate, a row reads "Almost gone". */
const ALMOST_GONE = 0.85

const customDaysOf = (form: EverydayForm): number | null => {
  if (form.period !== 'custom') return null
  const days = parseInt(form.customDays, 10)
  return days > 0 ? days : null
}

export const everydayFormOf = (b: LocalBudget): EverydayForm => ({
  categoryId: b.categoryId ?? '',
  amount: minorToInputValue(b.limit, b.currency),
  currency: b.currency,
  period: b.period,
  customDays: String(b.customDays ?? 30),
})

/** Why it can't be saved yet, or null when it can. */
export function everydayBlock(form: EverydayForm): string | null {
  if (!form.categoryId) return 'Pick a category'
  const amount = parseAmountToMinor(form.amount, form.currency)
  if (amount === null || amount <= 0) return 'Enter about how much'
  if (form.period === 'custom' && customDaysOf(form) === null)
    return 'Enter how many days'
  return null
}

/**
 * What a save writes. Call only once `everydayBlock` is null. Bill payments stay out of what it
 * counts, since the plan already has them.
 */
export const everydayWriteOf = (form: EverydayForm): BudgetDraft => ({
  scopeType: 'category',
  categoryId: form.categoryId,
  walletId: null,
  period: form.period,
  customDays: customDaysOf(form),
  limit: parseAmountToMinor(form.amount, form.currency) ?? 0,
  currency: form.currency,
  excludesBills: true,
  inPlan: true,
})

/** The editor's one-line consequence. */
export function everydayPreview(
  form: EverydayForm,
  ctx: { calendar: PayCalendar; base: CurrencyCode; rates: RatesMap },
): string {
  const amount = parseAmountToMinor(form.amount, form.currency)
  if (amount === null || amount <= 0)
    return 'Enter an estimate to see what it takes from your pay.'
  const perSlot = perSlotOf(
    convertMinor(amount, form.currency, ctx.base, ctx.rates),
    { period: form.period, customDays: customDaysOf(form) },
    ctx.calendar,
  )
  return `About ${money(perSlot, ctx.base)} ${perPeriod(ctx.calendar)} stays free for this. Nothing is locked away, and goals plan around it.`
}

/** What the recent monthly average comes to for the form's period, as a whole amount to type. */
export function suggestedAmount(
  monthly: number,
  form: EverydayForm,
  calendar: PayCalendar,
): string {
  const amount = perBudgetPeriodOf(
    monthly,
    { period: form.period, customDays: customDaysOf(form) },
    calendar,
  )
  return String(Math.max(1, Math.round(toMajor(amount, form.currency))))
}

const PERIOD_WORDS: Record<Exclude<BudgetPeriod, 'custom'>, string> = {
  weekly: 'a week',
  monthly: 'a month',
  paycheck: 'a paycheck',
}

/** "a month", "every 14 days". */
export const everydayCadenceLabel = (
  b: Pick<LocalBudget, 'period' | 'customDays'>,
): string =>
  b.period === 'custom'
    ? `every ${b.customDays ?? 30} days`
    : PERIOD_WORDS[b.period]

/** "About SR 2,000 a month · SR 1,200 left this month". */
export function everydayMeta(
  b: Pick<LocalBudget, 'limit' | 'currency' | 'period' | 'customDays'>,
  left: { amount: number; windowLabel: string } | null,
): string {
  const estimate = `About ${money(b.limit, b.currency)} ${everydayCadenceLabel(b)}`
  if (!left) return estimate
  return left.amount < 0
    ? `${estimate} · over ${left.windowLabel}`
    : `${estimate} · ${money(left.amount, b.currency)} left ${left.windowLabel}`
}

/** How the period is going; just "Estimate" while the spending hasn't been read. */
export function everydayChip(
  b: Pick<LocalBudget, 'limit' | 'currency'>,
  left: number | null,
): Chip {
  if (left === null) return { tone: 'neutral', label: 'Estimate' }
  if (left < 0)
    return { tone: 'danger', label: `Over by ${money(-left, b.currency)}` }
  if (b.limit - left >= b.limit * ALMOST_GONE)
    return { tone: 'warn', label: 'Almost gone' }
  return { tone: 'ok', label: 'On track' }
}
