/**
 * Planned transactions — the public surface. Pages and other slices import from here.
 * (The settlement slices' own write paths call `data/rows` directly, which is kept free of
 * other features so that link never forms a cycle.)
 */

// Types
export type { PlannedOrigin, PlannedRole, PlannedStatus } from './api/types'
export type { LocalPlanned } from '#/db/types'

// Hooks — reads
export { usePlanned } from './hooks/usePlanned'
export type { UsePlanned } from './hooks/usePlanned'
export { useGoalPlan } from './hooks/useGoalPlan'
export type { UseGoalPlan } from './hooks/useGoalPlan'
export { usePlannedMatch } from './hooks/usePlannedMatch'
export type { PlannedMatch } from './hooks/usePlannedMatch'
export { useConfirmPlanned } from './hooks/useConfirmPlanned'
export type { UseConfirmPlanned } from './hooks/useConfirmPlanned'
export { useRecalcAll } from './hooks/useRecalcAll'
export type { UseRecalcAll } from './hooks/useRecalcAll'
export { usePlannedData } from './hooks/usePlannedData'
export type { PlannedData } from './hooks/usePlannedData'

// Hooks — app-level
export { usePlannedRunner } from './hooks/usePlannedRunner'

// Mutations
export {
  addContribution,
  closeRest,
  confirmPlanned,
  deleteManualPlanned,
  dismissFromReview,
  editPlannedAmount,
  movePlanned,
  PlannedActionError,
  reopenPlanned,
  skipPlanned,
} from './data/mutations'
export type {
  ConfirmInput,
  ConfirmResult,
  ContributionInput,
  ContributionResult,
  PlannedActionCode,
} from './data/mutations'
export { recalcAllPlans, recalcPlan, runPlanner } from './data/runner'
export type {
  AutoSummary,
  PlannerRunSummary,
  RecalcResult,
} from './data/runner'

// Pure derivations and view models
export {
  behindOf,
  dueList,
  findMatch,
  isDue,
  MATCH_WINDOW,
  remainderOf,
  settledOf,
} from './data/settle'
export type { Behind, MatchRef, SettlementIndex } from './data/settle'
export {
  buildGoalPlanView,
  buildPlannedList,
  collapseContributions,
  NEXT_DAYS,
  relativeDue,
  shortDate,
  TAG_LABEL,
} from './data/views'
export type {
  ContributionEntry,
  ContributionRun,
  ContributionState,
  GoalPlanView,
  PlannedListView,
  PlannedRowView,
  PlannedTag,
} from './data/views'
export type { ConfirmPreview } from './data/preview'
export type { PlanHeader, PlanSnapshot } from './data/snapshot'
export { billOwner, goalOwner, ownerKey } from './data/owners'
export type { PlanOwner } from './data/owners'

// Stores
export { useRecalcUndoStore } from './stores/recalcUndo'
export { usePaydayNoticeStore } from './stores/paydayNotice'
export type { PaydayNotice } from './stores/paydayNotice'
