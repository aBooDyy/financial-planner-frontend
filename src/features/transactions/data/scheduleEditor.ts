/**
 * The budget and recurring editors' wording and readiness rules: pure, so the editors only
 * render them.
 */
import type {
  BudgetPeriod,
  BudgetScope,
} from '#/features/transactions/api/types'
import { parseISO, ymd } from './planning'

export const BUDGET_SCOPES: ReadonlyArray<{
  value: BudgetScope
  label: string
  description: string
}> = [
  { value: 'category', label: 'Category', description: 'One category' },
  { value: 'wallet', label: 'Account', description: 'One wallet' },
  { value: 'overall', label: 'Overall', description: 'All spending' },
]

export const BUDGET_PERIODS: ReadonlyArray<{
  value: BudgetPeriod
  label: string
}> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom days' },
]

export const customDaysValid = (customDays: string): boolean =>
  /^\d+$/.test(customDays.trim()) && parseInt(customDays, 10) >= 1

/** What still stands between a budget and saving it, or null when it is ready. */
export function budgetBlock(args: {
  limitMinor: number | null
  scopeType: BudgetScope
  /** The chosen wallet or category id; unread for an overall budget. */
  targetId: string
  period: BudgetPeriod
  customDays: string
}): string | null {
  if (args.limitMinor === null || args.limitMinor <= 0)
    return 'Add an amount to continue'
  if (args.scopeType !== 'overall' && !args.targetId)
    return args.scopeType === 'wallet'
      ? 'Pick an account first'
      : 'Pick a category first'
  if (args.period === 'custom' && !customDaysValid(args.customDays))
    return 'Set a period of at least 1 day'
  return null
}

export type DeleteCopy = { title: string; bullets: string[] }

export function budgetDeleteCopy(label: string): DeleteCopy {
  return {
    title: `Delete the “${label}” budget?`,
    bullets: [
      'Its limit and progress stop showing on Spending.',
      'Transactions it tracked stay in your history.',
    ],
  }
}

export function recurringDeleteCopy(
  name: string,
  type: 'spend' | 'income',
): DeleteCopy {
  const shown = name.trim()
  const subject = shown || 'this schedule'
  return {
    title: shown ? `Delete “${shown}”?` : 'Delete this recurring?',
    bullets:
      type === 'income'
        ? [
            `Future planned paydays for ${subject} are removed.`,
            'Income already received stays in your history.',
          ]
        : [
            `Future planned payments for ${subject} are removed.`,
            'Payments already made stay in your history.',
          ],
  }
}

export function adjustmentDeleteCopy(walletName: string | null): DeleteCopy {
  return {
    title: 'Delete this adjustment?',
    bullets: [
      walletName
        ? `${walletName}’s balance goes back to what it was without it.`
        : 'The balance goes back to what it was without it.',
      'Spending and income totals don’t change.',
    ],
  }
}

/** Where "Ends on a date" starts: a year after the next occurrence. */
export function defaultEndDate(nextDue: string): string {
  const d = parseISO(nextDue)
  return ymd(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()))
}

/** An end before the next occurrence would leave nothing to schedule. */
export const recurringEndBlock = (
  nextDue: string,
  endsOn: string | null,
): string | null =>
  endsOn !== null && endsOn < nextDue
    ? 'End date is before the next due date'
    : null
