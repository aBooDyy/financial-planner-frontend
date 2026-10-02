import { create } from 'zustand'

/**
 * What the planner just did on its own in Automatic payday mode, for the quiet toast
 * ("Set aside SR 5,600 for 5 items · 2 need a look · Review"). In memory only.
 */
export type PaydayNotice = {
  /** ISO date of the run. */
  at: string
  /** Set-asides made without a tap, and their total in base currency. */
  count: number
  total: number
  /** Lines sent to the payday review instead. */
  review: number
}

type PaydayNoticeState = {
  notice: PaydayNotice | null
  show: (notice: PaydayNotice) => void
  dismiss: () => void
}

export const usePaydayNoticeStore = create<PaydayNoticeState>((set) => ({
  notice: null,
  show: (notice) => set({ notice }),
  dismiss: () => set({ notice: null }),
}))
