/**
 * The goal editor's draft (04 §4): a target and/or a date, or a monthly amount when there is no
 * date — the three shapes fall out of which fields are filled. Pure.
 */
import type { LocalGoal } from '#/db/types'
import type { GoalDraft as GoalWrite } from '#/features/goals/data/mutations'
import { addMonthsISO } from '#/features/planned/data/dates'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import { paydaysIn } from '#/features/planning/data/payPeriods'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { GoalPreset } from '#/features/planning/stores/planningUi'
import { money, monthYear, perPeriod } from './format'

export type GoalForm = {
  name: string
  /** As typed; '' = no target. */
  target: string
  /** '' = no date. */
  dueDate: string
  /** "How much each month?" — read only without a date. */
  monthly: string
  saveWalletId: string | null
  mustHave: boolean
  color: string
}

export function newGoalForm(
  over: Partial<GoalForm>,
  preset?: GoalPreset,
  currency?: CurrencyCode,
): GoalForm {
  const asInput = (minor: number | null) =>
    minor !== null && currency ? minorToInputValue(minor, currency) : ''
  return {
    name: preset?.name ?? '',
    target: asInput(preset?.target ?? null),
    dueDate: '',
    monthly: asInput(preset?.amount ?? null),
    saveWalletId: null,
    mustHave: preset?.mustHave ?? false,
    color: '#D6457A',
    ...over,
  }
}

export const goalFormOf = (goal: LocalGoal): GoalForm => ({
  name: goal.name,
  target:
    goal.target !== null ? minorToInputValue(goal.target, goal.currency) : '',
  dueDate: goal.dueDate ?? '',
  monthly:
    goal.amount !== null ? minorToInputValue(goal.amount, goal.currency) : '',
  saveWalletId: goal.saveWalletId,
  mustHave: goal.mustHave,
  color: goal.color,
})

const positive = (value: string, currency: CurrencyCode): number | null => {
  const minor = parseAmountToMinor(value, currency)
  return minor !== null && minor > 0 ? minor : null
}

/** Why the goal can't be saved yet, or null when it can. */
export function goalBlock(
  form: GoalForm,
  currency: CurrencyCode,
  today: string,
): string | null {
  if (!form.name.trim()) return 'Give the goal a name'
  if (form.target.trim() && positive(form.target, currency) === null)
    return 'Enter a target above 0, or leave it empty'
  if (form.dueDate) {
    if (form.dueDate <= today) return 'Pick a date after today'
    if (positive(form.target, currency) === null)
      return 'Add how much you need by that date'
    return null
  }
  if (positive(form.monthly, currency) === null)
    return 'Pick a date or a monthly amount'
  return null
}

/** What a save writes. Call only once `goalBlock` is null. */
export function goalWriteOf(form: GoalForm, currency: CurrencyCode): GoalWrite {
  const dated = form.dueDate !== ''
  return {
    name: form.name.trim(),
    currency,
    color: form.color,
    target: positive(form.target, currency),
    amount: dated ? null : positive(form.monthly, currency),
    dueDate: dated ? form.dueDate : null,
    mustHave: form.mustHave,
    saveWalletId: form.saveWalletId,
  }
}

/** The live line under the goal editor: what to set aside, and when it gets there. */
export function goalPreview(
  form: GoalForm,
  ctx: {
    calendar: PayCalendar
    today: string
    currency: CurrencyCode
    /** What is saved already (editing). */
    saved: number
  },
): string {
  const target = positive(form.target, ctx.currency)
  const monthly = positive(form.monthly, ctx.currency)
  if (form.dueDate && form.dueDate > ctx.today) {
    if (target === null)
      return 'Add a target amount to work out what to set aside.'
    const left = target - ctx.saved
    if (left <= 0) return `You already have ${money(target, ctx.currency)}.`
    const paydays = paydaysIn(ctx.calendar, ctx.today, form.dueDate).length
    const per = Math.ceil(left / Math.max(1, paydays))
    return `Set aside ${money(per, ctx.currency)} ${perPeriod(ctx.calendar)} to have ${money(target, ctx.currency)} by ${monthYear(form.dueDate)}.`
  }
  if (monthly !== null) {
    if (target === null)
      return `Set aside ${money(monthly, ctx.currency)} a month, with no end date.`
    const left = target - ctx.saved
    if (left <= 0) return `You already have ${money(target, ctx.currency)}.`
    const months = Math.ceil(left / monthly)
    return `Set aside ${money(monthly, ctx.currency)} a month. Done around ${monthYear(addMonthsISO(ctx.today, months))}.`
  }
  return 'Pick a date or a monthly amount.'
}
