import { create } from 'zustand'

export type PlanningToast = {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

type ToastState = {
  toast: PlanningToast | null
  show: (message: string, action?: PlanningToast['action']) => void
  dismiss: (id?: number) => void
}

let nextId = 1

/** The one line confirming a Planning write ("Rent added to your plan"). */
export const usePlanningToast = create<ToastState>((set, get) => ({
  toast: null,
  show: (message, action) => set({ toast: { id: nextId++, message, action } }),
  dismiss: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null })
  },
}))

/** Shows a toast from outside React (after an awaited write). */
export const toast = (message: string, action?: PlanningToast['action']) =>
  usePlanningToast.getState().show(message, action)
