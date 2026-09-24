import { create } from 'zustand'

type PullState = {
  /**
   * Pulls that brought the planner's inputs (goals, spending, planned rows) home without an
   * error. Zero means this device has not seen the server's rows yet, so nothing may be
   * generated from them.
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
