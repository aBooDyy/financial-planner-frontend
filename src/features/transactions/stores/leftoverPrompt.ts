import { create } from 'zustand'
import type { LeftoverPrompt } from '#/features/transactions/data/billPayments'

/** The leftover prompt a bill payment saved outside Planning raised. In memory only. */
type LeftoverPromptState = {
  prompt: LeftoverPrompt | null
  show: (prompt: LeftoverPrompt | null) => void
  dismiss: () => void
}

export const useLeftoverPromptStore = create<LeftoverPromptState>((set) => ({
  prompt: null,
  show: (prompt) => {
    if (prompt) set({ prompt })
  },
  dismiss: () => set({ prompt: null }),
}))
