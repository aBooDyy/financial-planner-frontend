import type { LocalGoal } from '#/db/types'
import type { GoalDraft } from './mutations'

/** A new goal's stored row. */
export const goalRowOf = (
  draft: GoalDraft,
  at: { id: string; position: number; ts: string },
): LocalGoal => ({
  id: at.id,
  name: draft.name,
  currency: draft.currency,
  color: draft.color,
  position: at.position,
  target: draft.target,
  amount: draft.amount,
  dueDate: draft.dueDate,
  mustHave: draft.mustHave ?? false,
  saveWalletId: draft.saveWalletId ?? null,
  useCategoryId: draft.useCategoryId ?? null,
  closedAt: null,
  pausedAt: null,
  plannedAt: null,
  planAmount: null,
  planCount: null,
  planStart: null,
  setAsideDay: draft.setAsideDay ?? null,
  createdAt: at.ts,
  updatedAt: at.ts,
  version: '',
  dirty: 1,
  deleted: 0,
})
