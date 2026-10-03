/**
 * The detail panel's Plan box: what the plan does for this bill or goal, in one sentence, and
 * how the stored plan compares with today's numbers (04 §6). Pure.
 */
import type { LocalBill, LocalGoal } from '#/db/types'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import type { BillStatus, GoalStatus } from '#/features/planning/data/status'
import type { CurrencyCode } from '#/lib/currency'
import { dueDay, money, monthYear, perPeriod } from './format'

export function billPlanText(
  bill: LocalBill,
  s: BillStatus,
  walletName: string | null,
  calendar: PayCalendar,
  today: string,
): string {
  if (s.state === 'done') return 'Ended. Nothing more is set aside for it.'
  if (!s.occurrence) return 'Paid. Nothing is left to set aside.'
  const c = bill.currency
  const due = dueDay(s.occurrence, today)
  const where = walletName ? ` in ${walletName}` : ''
  if (s.state === 'not_set_aside')
    return `Due ${due}, before your next payday — it comes out of what is free now.`
  if (s.cycle === 'save_up')
    return s.perPaycheck > 0
      ? `Set aside ${money(s.perPaycheck, c)} ${perPeriod(calendar)}${where} until ${due}.`
      : `Saving up${where} for ${due}.`
  return `Covered from each ${calendar.kind === 'paycheck' ? 'paycheck' : 'month'}${bill.autopay ? ', logged by auto-pay' : ''}. Next on ${due}.`
}

export function goalPlanText(
  goal: LocalGoal,
  s: GoalStatus,
  calendar: PayCalendar,
): string {
  if (s.state === 'done') return 'Done. Nothing more is set aside for it.'
  if (s.state === 'paused')
    return 'Paused. Nothing is set aside until you resume it.'
  if (s.state === 'reached')
    return `Reached — ${money(s.progress, goal.currency)} saved.`
  const c = goal.currency
  const pace = `${money(s.perPaycheck, c)} ${perPeriod(calendar)}`
  if (goal.dueDate && s.target > 0)
    return s.state === 'short' && s.slipsTo
      ? `Set aside ${pace}. At this pace you reach ${money(s.target, c)} around ${monthYear(s.slipsTo)}, after ${monthYear(goal.dueDate)}.`
      : `Set aside ${pace} to reach ${money(s.target, c)} by ${monthYear(goal.dueDate)}.`
  if (s.target > 0)
    return s.finish
      ? `Set aside ${pace}. At this pace you reach ${money(s.target, c)} in ${monthYear(s.finish)}.`
      : `Set aside ${pace} toward ${money(s.target, c)}.`
  return `Set aside ${pace}, with no end date.`
}

/** "Your plan says SR 900 a paycheck; today it works out to SR 940." */
export function planDrift(
  stored: number,
  live: number,
  currency: CurrencyCode,
  calendar: PayCalendar,
): string {
  return `Your plan says ${money(stored, currency)} ${perPeriod(calendar)}; today it works out to ${money(live, currency)}.`
}
