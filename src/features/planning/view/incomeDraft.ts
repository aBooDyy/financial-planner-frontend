/**
 * The income editor's draft (02 Income, 04 §4): what comes in, how often, when it lands and
 * where. Pure.
 */
import type { LocalIncomeStream } from '#/db/types'
import type { IncomeDraft as IncomeWrite } from '#/features/goals/data/mutations'
import { intervalPhrase } from '#/features/goals/data/cadence'
import { paydaysOf } from '#/features/goals/data/paydays'
import { addDaysISO } from '#/features/planned/data/dates'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { dayMonth, money } from './format'
import {
  DEFAULT_REPEAT,
  REPEAT_ERROR,
  REPEAT_LABEL,
  repeatDraftFrom,
  repeatOf,
  repeatValid,
} from './repeat'
import type { RepeatDraft } from './repeat'

export type IncomeForm = {
  label: string
  amount: string
  /** "Paid into". */
  walletId: string | null
  repeat: RepeatDraft
  /** Monthly: the day of the month, as typed. */
  day: string
  /** Other cadences: a known payday every other one steps from. */
  anchorDate: string
  categoryId: string | null
  /** '' = no end. */
  endsOn: string
  autolog: boolean
  note: string
  color: string
}

export function newIncomeForm(over: Partial<IncomeForm>): IncomeForm {
  return {
    label: '',
    amount: '',
    walletId: null,
    repeat: DEFAULT_REPEAT,
    day: '',
    anchorDate: '',
    categoryId: null,
    endsOn: '',
    autolog: false,
    note: '',
    color: '#1F9D6B',
    ...over,
  }
}

export const incomeFormOf = (s: LocalIncomeStream): IncomeForm => ({
  label: s.label,
  amount: s.amount > 0 ? minorToInputValue(s.amount, s.currency) : '',
  walletId: s.walletId,
  repeat: repeatDraftFrom(s),
  day: String(s.day),
  anchorDate: s.anchorDate ?? '',
  categoryId: s.categoryId,
  endsOn: s.endsOn ?? '',
  autolog: s.autolog,
  note: s.note ?? '',
  color: s.color,
})

const isMonthly = (form: IncomeForm) => form.repeat.pick === 'monthly'

const dayOf = (form: IncomeForm): number | null => {
  const day = Number(form.day)
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null
}

/** Why the income can't be saved yet, or null when it can. */
export function incomeBlock(
  form: IncomeForm,
  currency: CurrencyCode,
): string | null {
  if (!form.label.trim()) return 'Give the income a name'
  const amount = parseAmountToMinor(form.amount, currency)
  if (amount === null || amount <= 0) return 'Enter how much comes in'
  if (!repeatValid(form.repeat)) return REPEAT_ERROR
  if (isMonthly(form) && dayOf(form) === null)
    return 'Pick the day of the month it lands, 1 to 31'
  if (!isMonthly(form) && !form.anchorDate) return 'Pick the next payday'
  if (!form.categoryId) return 'Pick a category'
  return null
}

/** The pay schedule the form describes. */
function scheduleOf(form: IncomeForm) {
  const repeat = repeatOf(form.repeat)
  const frequency = repeat.frequency ?? 'monthly'
  return isMonthly(form)
    ? {
        ...repeat,
        frequency,
        day: dayOf(form) ?? 1,
        anchorDate: null,
      }
    : {
        ...repeat,
        frequency,
        day: Number(form.anchorDate.slice(8, 10)) || 1,
        anchorDate: form.anchorDate || null,
      }
}

/** What a save writes. Call only once `incomeBlock` is null. */
export function incomeWriteOf(
  form: IncomeForm,
  currency: CurrencyCode,
): IncomeWrite {
  return {
    label: form.label.trim(),
    amount: parseAmountToMinor(form.amount, currency) ?? 0,
    currency,
    ...scheduleOf(form),
    walletId: form.walletId,
    categoryId: form.categoryId ?? '',
    endsOn: form.endsOn || null,
    autolog: form.autolog,
    note: form.note.trim() || null,
    color: form.color,
  }
}

/** The form's next payday on or after `today`, or null while the schedule is incomplete. */
export function nextPaydayOfForm(
  form: IncomeForm,
  today: string,
): string | null {
  if (!repeatValid(form.repeat)) return null
  if (isMonthly(form) ? dayOf(form) === null : !form.anchorDate) return null
  // The payday the user picked reads as the next one, even where the cadence steps back past it.
  if (!isMonthly(form) && form.anchorDate >= today) return form.anchorDate
  return paydaysOf(scheduleOf(form), today, addDaysISO(today, 400))[0] ?? null
}

/** "SR 12,000 monthly · next payday Oct 25." */
export function incomePreview(
  form: IncomeForm,
  ctx: { today: string; currency: CurrencyCode },
): string {
  const amount = parseAmountToMinor(form.amount, ctx.currency)
  if (amount === null || amount <= 0)
    return 'Enter an amount to see your next payday.'
  const next = nextPaydayOfForm(form, ctx.today)
  if (!next) return `${money(amount, ctx.currency)} — pick when it lands.`
  const cadence =
    form.repeat.pick === 'custom'
      ? intervalPhrase(Number(form.repeat.every), form.repeat.unit)
      : REPEAT_LABEL[form.repeat.pick].toLowerCase()
  return `${money(amount, ctx.currency)} ${cadence} · next payday ${dayMonth(next)}.`
}
