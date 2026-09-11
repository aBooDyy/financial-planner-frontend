import type {
  LocalGoal,
  LocalGoalAllocation,
  LocalIncomeStream,
} from '#/db/types'
import type {
  CreateGoalAllocationWire,
  CreateGoalWire,
  CreateIncomeWire,
  Goal,
  GoalAllocation,
  IncomeStream,
  UpdateGoalAllocationWire,
  UpdateGoalWire,
  UpdateIncomeWire,
} from '#/features/goals/api/types'
import {
  toWireFreq,
  toWireKind,
  toWireSource,
} from '#/features/goals/api/types'

// --- Income streams ------------------------------------------------------------------

/** Server income stream → local record (freshly synced: clean, not deleted). */
export const serverIncomeToLocal = (s: IncomeStream): LocalIncomeStream => ({
  id: s.id,
  label: s.label,
  amount: s.amount,
  currency: s.currency,
  frequency: s.frequency,
  day: s.day,
  color: s.color,
  position: s.position,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
  version: s.version,
  dirty: 0,
  deleted: 0,
})

export const localIncomeToCreateWire = (
  l: LocalIncomeStream,
): CreateIncomeWire => ({
  id: l.id,
  label: l.label,
  amount: l.amount,
  currency: l.currency,
  frequency: toWireFreq(l.frequency),
  day: l.day,
  color: l.color,
  position: l.position,
})

// The update is based on the last-synced `version` (optimistic locking base).
export const localIncomeToUpdateWire = (
  l: LocalIncomeStream,
): UpdateIncomeWire => ({
  version: l.version,
  label: l.label,
  amount: l.amount,
  currency: l.currency,
  frequency: toWireFreq(l.frequency),
  day: l.day,
  color: l.color,
  position: l.position,
})

// --- Goals ---------------------------------------------------------------------------

export const serverGoalToLocal = (g: Goal): LocalGoal => ({
  id: g.id,
  name: g.name,
  kind: g.kind,
  currency: g.currency,
  color: g.color,
  position: g.position,
  amount: g.amount,
  target: g.target,
  saved: g.saved,
  frequency: g.frequency,
  nextDue: g.nextDue,
  dueDate: g.dueDate,
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
  version: g.version,
  dirty: 0,
  deleted: 0,
})

export const localGoalToCreateWire = (l: LocalGoal): CreateGoalWire => ({
  id: l.id,
  kind: toWireKind(l.kind),
  name: l.name,
  currency: l.currency,
  color: l.color,
  position: l.position,
  amount: l.amount,
  target: l.target,
  saved: l.saved,
  frequency: l.frequency ? toWireFreq(l.frequency) : null,
  next_due: l.nextDue,
  due_date: l.dueDate,
})

export const localGoalToUpdateWire = (l: LocalGoal): UpdateGoalWire => ({
  version: l.version,
  name: l.name,
  currency: l.currency,
  color: l.color,
  position: l.position,
  amount: l.amount,
  target: l.target,
  saved: l.saved,
  frequency: l.frequency ? toWireFreq(l.frequency) : null,
  next_due: l.nextDue,
  due_date: l.dueDate,
})

// --- Goal allocations ----------------------------------------------------------------

export const serverAllocationToLocal = (
  a: GoalAllocation,
): LocalGoalAllocation => ({
  id: a.id,
  goalId: a.goalId,
  source: a.source,
  walletId: a.walletId,
  externalLabel: a.externalLabel,
  amount: a.amount,
  currency: a.currency,
  note: a.note,
  position: a.position,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
  version: a.version,
  dirty: 0,
  deleted: 0,
})

export const localAllocationToCreateWire = (
  l: LocalGoalAllocation,
): CreateGoalAllocationWire => ({
  id: l.id,
  goal_id: l.goalId,
  source: toWireSource(l.source),
  wallet_id: l.walletId,
  external_label: l.externalLabel,
  amount: l.amount,
  currency: l.currency,
  note: l.note,
  position: l.position,
})

export const localAllocationToUpdateWire = (
  l: LocalGoalAllocation,
): UpdateGoalAllocationWire => ({
  version: l.version,
  source: toWireSource(l.source),
  wallet_id: l.walletId,
  external_label: l.externalLabel,
  amount: l.amount,
  currency: l.currency,
  note: l.note,
  position: l.position,
})
