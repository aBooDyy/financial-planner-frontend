/**
 * "+ Add contribution" (1b) copy: the hint under the fields and the button's label. Pure, so
 * the dialog stays dumb and every branch of the wording is testable.
 */
import { addMonths, ymd } from '#/features/goals/data/planning'
import type { CurrencyCode } from '#/lib/currency'
import { monthDay, tidyMoney } from './goalDetail'

export type ContributionMode = 'now' | 'later'

export type ContributionCopyInput = {
  mode: ContributionMode
  /** Goal currency, minor units; 0 when nothing (valid) is typed. */
  amount: number
  currency: CurrencyCode
  goalName: string
  /** `payment` for a bill (the money leaves), `set_aside` for saving (it stays, reserved). */
  role: 'payment' | 'set_aside'
  /** Progress so far, goal currency. */
  saved: number
  /** The due planned item "Paid now" would settle instead of adding beside it. */
  due: { date: string; remainder: number; currency: CurrencyCode } | null
  /** Set-asides only: the external source's label when that is the source. */
  externalLabel: string | null
  date: string
}

export function contributionCopy(input: ContributionCopyInput): {
  hint: string
  cta: string
} {
  const { mode, amount, currency, goalName, role } = input
  const money = (minor: number) => tidyMoney(minor, currency)
  const cta =
    amount > 0
      ? `${mode === 'now' ? 'Add' : 'Plan'} ${money(amount)}`
      : mode === 'now'
        ? 'Add'
        : 'Plan'

  if (mode === 'later')
    return {
      hint: `Adds a planned item on ${input.date ? monthDay(input.date) : 'that date'}. It shows in Spending as planned and only counts once you confirm it.`,
      cta,
    }

  const noun = role === 'payment' ? 'payment' : 'set-aside'
  const after = `${role === 'payment' ? 'Paid' : 'Saved'} goes to ${money(input.saved + amount)}.`
  if (input.due) {
    const dueAmount = tidyMoney(input.due.remainder, input.due.currency)
    return {
      hint: `Settles the planned ${monthDay(input.due.date)} ${noun} (${dueAmount}) instead of adding a second entry. ${after}`,
      cta,
    }
  }
  if (role === 'payment')
    return {
      hint: `Adds a confirmed payment in Spending, tagged ${goalName}. ${after}`,
      cta,
    }
  const external = input.externalLabel?.trim()
  return {
    hint: external
      ? `Adds ${external} as a set-aside for ${goalName}, held outside your wallets. ${after}`
      : `Adds a confirmed set-aside, tagged ${goalName}. The money stays in the wallet, reserved. ${after}`,
    cta,
  }
}

/** "Plan for later" starts on the next planned date, else a month from today. */
export const laterDefaultDate = (
  nextPlanned: string | null,
  today: Date,
): string => nextPlanned ?? ymd(addMonths(today, 1))
