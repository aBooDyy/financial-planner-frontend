/**
 * The bill editor's draft (04 §4): what the form holds, what blocks saving, the live preview
 * line and what a save writes. Pure; the hook owns the state and the writes.
 */
import type { LocalBill, LocalPlanned } from '#/db/types'
import type { BillDraft as BillWrite } from '#/features/bills/data/mutations'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import { paydaysIn } from '#/features/planning/data/payPeriods'
import { nthOccurrence } from '#/features/planning/data/occurrences'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { dayMonth, fullDate, money, perPeriod } from './format'
import {
  DEFAULT_REPEAT,
  REPEAT_ERROR,
  perYearOf,
  repeatDraftFrom,
  repeatOf,
  repeatValid,
} from './repeat'
import type { RepeatDraft } from './repeat'

/** "Ends": never, after a number of occurrences, or on a date. */
export type EndsPick = 'never' | 'count' | 'date'

export const DEFAULT_ENDS_COUNT = 12
export const ENDS_COUNT_MAX = 999
export const ENDS_COUNT_ERROR = `Ends after 1 to ${ENDS_COUNT_MAX} times`

/** The bill's payment rows by occurrence; they keep a month-end bill on its day. */
type Payments = ReadonlyMap<string, LocalPlanned>

export type BillForm = {
  name: string
  /** As typed. */
  amount: string
  /** "Paid from"; null = decide when paying. */
  walletId: string | null
  repeat: RepeatDraft
  nextDue: string
  categoryId: string | null
  /** Repeating only. */
  ends: EndsPick
  /** As typed; read only for `count`. */
  endsCount: string
  /** Read only for `date`. */
  endsOn: string
  autopay: boolean
  mustPay: boolean
  /** "Save up in"; null = the paid-from wallet. */
  saveWalletId: string | null
  merchantId: string | null
  note: string
  color: string
}

export function newBillForm(over: Partial<BillForm>): BillForm {
  return {
    name: '',
    amount: '',
    walletId: null,
    repeat: DEFAULT_REPEAT,
    nextDue: '',
    categoryId: null,
    ends: 'never',
    endsCount: String(DEFAULT_ENDS_COUNT),
    endsOn: '',
    autopay: false,
    mustPay: true,
    saveWalletId: null,
    merchantId: null,
    note: '',
    color: '#64748B',
    ...over,
  }
}

export const billFormOf = (bill: LocalBill): BillForm => ({
  name: bill.name,
  amount: bill.amount > 0 ? minorToInputValue(bill.amount, bill.currency) : '',
  walletId: bill.walletId,
  repeat: repeatDraftFrom(bill),
  nextDue: bill.nextDue,
  categoryId: bill.categoryId,
  ends: bill.endsOn ? 'date' : 'never',
  endsCount: String(DEFAULT_ENDS_COUNT),
  endsOn: bill.endsOn ?? '',
  autopay: bill.autopay,
  mustPay: bill.mustPay,
  saveWalletId: bill.saveWalletId,
  merchantId: bill.merchantId,
  note: bill.note ?? '',
  color: bill.color,
})

/** Why the bill can't be saved yet, or null when it can. */
export function billBlock(
  form: BillForm,
  currency: CurrencyCode,
): string | null {
  if (!form.name.trim()) return 'Give the bill a name'
  const amount = parseAmountToMinor(form.amount, currency)
  if (amount === null || amount <= 0) return 'Enter how much it is'
  if (!form.nextDue)
    return form.repeat.pick === 'once'
      ? 'Pick when it is due'
      : 'Pick the next due date'
  if (!repeatValid(form.repeat)) return REPEAT_ERROR
  if (!form.categoryId) return 'Pick a category'
  if (form.repeat.pick === 'once') return null
  if (form.ends === 'count' && !endsCountValid(form)) return ENDS_COUNT_ERROR
  if (form.ends === 'date' && !form.endsOn) return 'Pick when it ends'
  if (form.ends === 'date' && form.endsOn < form.nextDue)
    return 'It can’t end before it is next due'
  return null
}

export function endsCountValid(form: BillForm): boolean {
  const count = Number(form.endsCount)
  return Number.isInteger(count) && count >= 1 && count <= ENDS_COUNT_MAX
}

/**
 * The date the draft ends on: '' for never, a one-off, or while "After N times" can't be
 * worked out yet. N times ends on the Nth occurrence, `nextDue` being the first.
 */
export function endsOnOf(form: BillForm, payments: Payments): string {
  if (form.repeat.pick === 'once' || form.ends === 'never') return ''
  if (form.ends === 'date') return form.endsOn
  if (!form.nextDue || !repeatValid(form.repeat) || !endsCountValid(form))
    return ''
  return nthOccurrence(
    { nextDue: form.nextDue, ...repeatOf(form.repeat) },
    payments,
    Number(form.endsCount),
  )
}

/** "Last one on Mar 1, 2027" under "After N times"; null otherwise or while unknown. */
export function lastOneLine(form: BillForm, payments: Payments): string | null {
  if (form.ends !== 'count') return null
  const last = endsOnOf(form, payments)
  return last ? `Last one on ${fullDate(last)}` : null
}

/** The draft with another "Ends" pick; "On a date" starts from the date it would end on. */
export function withEnds(
  form: BillForm,
  ends: EndsPick,
  payments: Payments,
): BillForm {
  if (ends !== 'date' || form.endsOn) return { ...form, ends }
  return {
    ...form,
    ends,
    endsOn: endsOnOf(form, payments) || form.nextDue,
  }
}

/** What a save writes. Call only once `billBlock` is null. */
export function billWriteOf(
  form: BillForm,
  currency: CurrencyCode,
  payments: Payments,
): BillWrite {
  return {
    name: form.name.trim(),
    amount: parseAmountToMinor(form.amount, currency) ?? 0,
    currency,
    ...repeatOf(form.repeat),
    nextDue: form.nextDue,
    endsOn: endsOnOf(form, payments) || null,
    walletId: form.walletId,
    saveWalletId:
      form.saveWalletId && form.saveWalletId !== form.walletId
        ? form.saveWalletId
        : null,
    categoryId: form.categoryId ?? '',
    merchantId: form.merchantId,
    note: form.note.trim() || null,
    autopay: form.autopay,
    mustPay: form.mustPay,
    color: form.color,
  }
}

/**
 * The editor's one-line consequence: covered from each paycheck, saved up for over the paydays
 * before it is due, or — due before the next payday — paid from what is free now.
 */
export function billPreview(
  form: BillForm,
  ctx: { calendar: PayCalendar; today: string; currency: CurrencyCode },
): string {
  const amount = parseAmountToMinor(form.amount, ctx.currency)
  if (amount === null || amount <= 0)
    return 'Enter an amount to see how it fits.'
  if (!form.nextDue) return 'Pick a due date to see how it fits.'
  const paydays = paydaysIn(ctx.calendar, ctx.today, form.nextDue)
  if (paydays.length === 0)
    return 'Due before your next paycheck. It will come out of what is free now.'
  const perYear = perYearOf(form.repeat)
  if (perYear > 0 && perYear >= ctx.calendar.perYear - 1e-9)
    return `Covered from ${ctx.calendar.kind === 'paycheck' ? 'each paycheck' : 'each month’s income'}.`
  if (paydays.length === 1)
    return `Covered from your ${dayMonth(paydays[0])} ${ctx.calendar.kind === 'paycheck' ? 'paycheck' : 'income'}, ready on ${dayMonth(form.nextDue)}.`
  const per = Math.ceil(amount / paydays.length)
  return `We’ll set aside ${money(per, ctx.currency)} ${perPeriod(ctx.calendar)} so it’s ready on ${dayMonth(form.nextDue)}.`
}
