import { create } from 'zustand'

/** Whether the app-wide "add transaction" sheet is open. In memory only. */
type QuickAddState = {
  open: boolean
  show: () => void
  hide: () => void
}

export const useQuickAddStore = create<QuickAddState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
