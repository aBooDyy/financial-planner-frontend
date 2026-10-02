import { create } from 'zustand'
import type { PlanOwner } from '#/features/planned/data/owners'
import type { LeftoverReport } from '#/features/planning/data/leftover'

/** A goal the editor starts from (the Emergency fund suggestion). */
export type GoalPreset = {
  name: string
  target: number | null
  amount: number | null
  mustHave: boolean
}

/** The one modal the Planning page shows at a time. */
export type PlanningSheet =
  | { kind: 'chooser' }
  | { kind: 'bill'; id: string | null }
  | { kind: 'goal'; id: string | null; preset?: GoalPreset }
  | { kind: 'income'; id: string | null }
  | { kind: 'addMoney'; owner: PlanOwner }
  | { kind: 'payNow'; billId: string; occurrence?: string }
  | {
      kind: 'leftover'
      report: LeftoverReport
      payingWalletId: string
      date: string
    }
  | { kind: 'markDone'; owner: PlanOwner }
  | { kind: 'useIt'; goalId: string }
  | { kind: 'delete'; target: { kind: 'bill' | 'goal' | 'income'; id: string } }
  | { kind: 'review'; payday: string | null }
  | { kind: 'confirmPlanned'; plannedId: string }

type PlanningUiState = {
  /** The bill or goal whose detail panel is open. */
  detail: PlanOwner | null
  sheet: PlanningSheet | null
  openDetail: (owner: PlanOwner) => void
  closeDetail: () => void
  openSheet: (sheet: PlanningSheet) => void
  closeSheet: () => void
}

/**
 * What the Planning page has open: the detail panel and the one sheet on top. Page-scoped UI
 * state in a store so a row deep in a section can open a sheet without threading callbacks.
 */
export const usePlanningUi = create<PlanningUiState>((set) => ({
  detail: null,
  sheet: null,
  openDetail: (detail) => set({ detail }),
  closeDetail: () => set({ detail: null }),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
}))
