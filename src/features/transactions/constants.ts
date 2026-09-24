import type { BudgetPeriod } from '#/features/transactions/api/types'

// Fixed status colors (independent of theme), mirroring the Means design.
export const RED = '#E5484D'
export const AMBER = '#D9882B'

export type RangeMode = 'year' | 'month' | 'week' | 'day'

// Budget period display + the over/at-risk thresholds the burn bar uses.
export const BUDGET_PERIODS: Record<BudgetPeriod, { label: string }> = {
  weekly: { label: 'Weekly' },
  monthly: { label: 'Monthly' },
  custom: { label: 'Custom days' },
}

export const AT_RISK_RATIO = 0.8

// Colors a transaction view falls back to for chart segments without a category color.
export const NEUTRAL_BORDER = 'var(--border-strong)'
