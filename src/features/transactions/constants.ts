import type { BudgetPeriod } from '#/features/transactions/api/types'

// Fixed status colors (independent of theme), mirroring the Means design.
export const RED = '#E5484D'
export const AMBER = '#D9882B'

export type RangeMode = 'year' | 'month' | 'week' | 'day'

/** How the Spending page's period was chosen: a range mode, or a span the user picked. */
export type PeriodMode = RangeMode | 'custom'

/** The Spending page's tabs, in order; each is a `/transactions/<view>` route. */
export const SPENDING_VIEWS = [
  'activity',
  'planned',
  'budgets',
  'recurring',
] as const

export type SpendingView = (typeof SPENDING_VIEWS)[number]

export const isSpendingView = (value: string): value is SpendingView =>
  (SPENDING_VIEWS as readonly string[]).includes(value)

// Budget period display + the over/at-risk thresholds the burn bar uses.
export const BUDGET_PERIODS: Record<BudgetPeriod, { label: string }> = {
  weekly: { label: 'Weekly' },
  monthly: { label: 'Monthly' },
  custom: { label: 'Custom days' },
}

export const AT_RISK_RATIO = 0.8

// Colors a transaction view falls back to for chart segments without a category color.
export const NEUTRAL_BORDER = 'var(--border-strong)'
