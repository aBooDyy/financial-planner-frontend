import { create } from 'zustand'

type PullState = {
  /**
   * Pulls in this app load that brought the planner's inputs (goals, spending, planned rows)
   * home without an error. Whether the device has ever had them is `plannerInputsOnDevice`.
   */
  plannerInputsPulled: number
}

export const usePullStateStore = create<PullState>(() => ({
  plannerInputsPulled: 0,
}))

export const notePlannerInputsPulled = (): void =>
  usePullStateStore.setState((s) => ({
    plannerInputsPulled: s.plannerInputsPulled + 1,
  }))

export const resetPullState = (): void =>
  usePullStateStore.setState({ plannerInputsPulled: 0 })
