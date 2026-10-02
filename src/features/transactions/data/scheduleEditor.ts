/**
 * The budget editor's wording and readiness rules: pure, so the editor only renders them.
 */
import type { LocalBalanceNode, LocalBill } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { periodOf } from '#/features/planning/data/payPeriods'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import type {
  BudgetPeriod,
  BudgetScope,
} from '#/features/transactions/api/types'
import { formatMoneyRounded } from '#/lib/currency'
import { fmtShort, parseISO } from './planning'

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
  { value: 'paycheck', label: 'Per paycheck' },
  { value: 'custom', label: 'Custom' },
]

/**
 * Under the Per paycheck chip: the pay period it would measure now, or — without a main
 * paycheck — that it falls back to calendar months.
 */
export function paycheckHint(cal: PayCalendar, today: string): string {
  if (cal.kind === 'month')
    return 'Add your income to budget per paycheck — until then this resets monthly.'
  const { start, end } = periodOf(cal, today)
  return `Resets every payday · ${fmtShort(parseISO(start))} – ${fmtShort(parseISO(end))}`
}

/** Bills a budget would cover — the ones "Leave out planned bills" is about. */
export function billsInBudget(
  bills: ReadonlyArray<LocalBill>,
  target: { scopeType: BudgetScope; categoryId: string; walletId: string },
  catalog: CategoryCatalog,
): LocalBill[] {
  return bills.filter(
    (b) =>
      b.deleted === 0 &&
      b.closedAt === null &&
      (target.scopeType === 'overall' ||
        (target.scopeType === 'category'
          ? catalog.rootOf(b.categoryId).id ===
            catalog.rootOf(target.categoryId).id
          : b.walletId === target.walletId)),
  )
}

const BILL_LINES = 3

/**
 * "Rent (SR 3,000) is planned as a bill in Housing." — one line per bill the budget covers,
 * the first few, then how many more.
 */
export function billLines(
  bills: ReadonlyArray<LocalBill>,
  target: { scopeType: BudgetScope; categoryId: string; walletId: string },
  catalog: CategoryCatalog,
  nodes: ReadonlyArray<Pick<LocalBalanceNode, 'id' | 'name'>>,
): string[] {
  const where =
    target.scopeType === 'category'
      ? ` in ${catalog.rootOf(target.categoryId).name}`
      : target.scopeType === 'wallet'
        ? ` from ${nodes.find((n) => n.id === target.walletId)?.name ?? 'this account'}`
        : ''
  const lines = bills
    .slice(0, BILL_LINES)
    .map(
      (b) =>
        `${b.name}${b.amount > 0 ? ` (${formatMoneyRounded(b.amount, b.currency)})` : ''} is planned as a bill${where}.`,
    )
  const more = bills.length - BILL_LINES
  if (more > 0) lines.push(`And ${more} more ${more === 1 ? 'bill' : 'bills'}.`)
  return lines
}

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
