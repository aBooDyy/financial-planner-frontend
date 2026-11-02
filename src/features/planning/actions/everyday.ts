import { db } from '#/db/db'
import type { LocalBudget } from '#/db/types'
import {
  createBudget,
  updateBudget,
} from '#/features/transactions/data/mutations'
import type { BudgetDraft } from '#/features/transactions/data/mutations'

const draftOf = (b: LocalBudget): BudgetDraft => ({
  scopeType: b.scopeType,
  categoryId: b.categoryId,
  walletId: b.walletId,
  period: b.period,
  customDays: b.customDays,
  limit: b.limit,
  currency: b.currency,
})

/**
 * Saves everyday spending as its category's budget: a category keeps one budget, so one that
 * exists is changed rather than joined by a second.
 */
export async function saveEveryday(
  id: string | null,
  draft: BudgetDraft,
): Promise<void> {
  const budgets = await db.budgets.toArray()
  const existing = id
    ? budgets.find((b) => b.id === id)
    : budgets.find(
        (b) =>
          b.deleted === 0 &&
          b.scopeType === 'category' &&
          b.categoryId === draft.categoryId,
      )
  if (existing) await updateBudget(existing.id, draft)
  else await createBudget(draft)
}

/** Takes it out of the plan; the budget stays as a plain cap on Spending. */
export async function removeEveryday(id: string): Promise<void> {
  const budget = await db.budgets.get(id)
  if (budget) await updateBudget(id, { ...draftOf(budget), inPlan: false })
}
