import type { LocalBudget } from '#/db/types'
import type { BudgetDraft } from './mutations'

/** The stored row of a budget draft; a field the draft leaves out keeps `kept`'s choice. */
export const budgetRowOf = (
  id: string,
  d: BudgetDraft,
  ts: string,
  kept?: Pick<LocalBudget, 'excludesBills' | 'inPlan'>,
): LocalBudget => ({
  id,
  scopeType: d.scopeType,
  categoryId: d.scopeType === 'category' ? d.categoryId : null,
  walletId: d.scopeType === 'wallet' ? d.walletId : null,
  period: d.period,
  customDays: d.period === 'custom' ? d.customDays : null,
  limit: d.limit,
  currency: d.currency,
  excludesBills: d.excludesBills ?? kept?.excludesBills ?? false,
  inPlan: d.scopeType === 'category' && (d.inPlan ?? kept?.inPlan ?? false),
  createdAt: ts,
  updatedAt: ts,
  version: '',
  dirty: 1,
  deleted: 0,
})
