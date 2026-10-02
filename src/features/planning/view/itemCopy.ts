/**
 * How a bill's or goal's state reads on its row, its detail and in Upcoming — the docs'
 * vocabulary (02 Status, D27): Covered ✓ · Saving up 800 / 2,400 · Behind by 200 · Short ·
 * Due · confirm for bills; Saving up · Behind · Short · Reached · Paused for goals. Pure.
 */
import type { LocalBill, LocalGoal } from '#/db/types'
import { daysBetween } from '#/features/planned/data/dates'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import type { BillStatus, GoalStatus } from '#/features/planning/data/status'
import type { ChipTone } from '#/features/planning/components/kit/StatusChip'
import { dayMonth, figure, money, monthYear, perPeriod } from './format'
import { repeatLabel } from './repeat'

export type Chip = { tone: ChipTone; label: string }

/** Due within this many days reads "Due in N days" in warn. */
export const SOON_DAYS = 7

function dueChip(occurrence: string, today: string): Chip {
  const days = daysBetween(today, occurrence)
  return days <= SOON_DAYS
    ? {
        tone: 'warn',
        label:
          days <= 0
            ? 'Due today'
            : days === 1
              ? 'Due tomorrow'
              : `Due in ${days} days`,
      }
    : { tone: 'neutral', label: `Due ${dayMonth(occurrence)}` }
}

export function billChip(s: BillStatus, currency: string, today: string): Chip {
  switch (s.state) {
    case 'done':
      return { tone: 'neutral', label: 'Done' }
    case 'paid':
      return { tone: 'ok', label: 'Paid' }
    case 'due':
      return { tone: 'warn', label: 'Due · confirm' }
    case 'covered':
      return { tone: 'ok', label: 'Covered ✓' }
    case 'short':
      return { tone: 'danger', label: `Short ${money(s.shortBy, currency)}` }
    case 'behind':
      return {
        tone: 'warn',
        label: `Behind by ${money(s.behindBy, currency)}`,
      }
    case 'not_set_aside':
      return s.occurrence
        ? dueChip(s.occurrence, today)
        : { tone: 'neutral', label: 'Not set aside yet' }
    case 'saving_up':
      if (s.cycle === 'each_paycheck' && s.occurrence)
        return dueChip(s.occurrence, today)
      return {
        tone: 'blue',
        label: `Saving up ${figure(s.setAside, currency)} / ${figure(s.amount, currency)}`,
      }
  }
}

/** "Monthly · next Nov 1 · Main bank · auto-pay" / "SR 800 of SR 2,400 · due Mar 1 · SR 320 a paycheck". */
export function billMeta(
  bill: LocalBill,
  s: BillStatus,
  walletName: string | null,
  calendar: PayCalendar,
): string {
  const c = bill.currency
  if (s.state === 'done') return `${repeatLabel(bill)} · ended`
  if (s.state === 'paid' || !s.occurrence)
    return `${repeatLabel(bill)} · nothing left to pay`
  if (s.cycle === 'save_up')
    return [
      `${money(s.setAside, c)} of ${money(s.amount, c)}`,
      `due ${dayMonth(s.occurrence)}`,
      s.perPaycheck > 0
        ? `${money(s.perPaycheck, c)} ${perPeriod(calendar)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')
  return [
    repeatLabel(bill),
    `next ${dayMonth(s.occurrence)}`,
    walletName,
    bill.autopay ? 'auto-pay' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function goalChip(s: GoalStatus, currency: string): Chip {
  switch (s.state) {
    case 'done':
      return { tone: 'neutral', label: 'Done' }
    case 'paused':
      return { tone: 'neutral', label: 'Paused' }
    case 'reached':
      return { tone: 'ok', label: 'Reached' }
    case 'short':
      return { tone: 'danger', label: `Short ${money(s.shortBy, currency)}` }
    case 'behind':
      return {
        tone: 'warn',
        label: `Behind by ${money(s.behindBy, currency)}`,
      }
    case 'saving_up':
      return { tone: s.ongoing ? 'goal' : 'ok', label: 'Saving up' }
  }
}

/** "SR 5,500 of SR 13,000 · by Jun 2027 · SR 940 a paycheck". */
export function goalMeta(
  goal: LocalGoal,
  s: GoalStatus,
  calendar: PayCalendar,
): string {
  const c = goal.currency
  const saved =
    s.target > 0
      ? `${money(s.progress, c)} of ${money(s.target, c)}`
      : `${money(s.progress, c)} saved`
  const pace =
    s.state === 'paused' || s.state === 'done' || s.perPaycheck <= 0
      ? null
      : `${money(s.perPaycheck, c)} ${perPeriod(calendar)}`
  return [
    saved,
    goal.dueDate ? `by ${monthYear(goal.dueDate)}` : null,
    pace,
    !goal.dueDate && s.finish && s.target > 0
      ? `done ${monthYear(s.finish)}`
      : null,
    s.state === 'short' && s.slipsTo
      ? `slips to ${monthYear(s.slipsTo)}`
      : null,
    s.heldIn.some((h) => h.walletId === null) ? 'some held outside' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
