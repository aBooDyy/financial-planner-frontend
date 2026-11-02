import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Tryout, WhatIfItem } from '#/features/planning/data/whatIf'
import { newId } from '#/lib/uuid'

type WhatIfState = {
  items: WhatIfItem[]
  /** Adds a new item, or replaces the one `id` names. */
  save: (id: string | null, tryout: Tryout) => void
  toggle: (id: string) => void
  remove: (id: string) => void
  clear: () => void
}

/**
 * What the user is trying out. It stays on this device, never reaches the plan or the server, and
 * survives closing the app so a decision can wait; signing out clears it.
 */
export const useWhatIf = create<WhatIfState>()(
  persist(
    (set) => ({
      items: [],
      save: (id, tryout) =>
        set((s) => ({
          items: id
            ? s.items.map((i) => (i.id === id ? { ...tryout, id, on: i.on } : i))
            : [...s.items, { ...tryout, id: newId(), on: true }],
        })),
      toggle: (id) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, on: !i.on } : i)),
        })),
      remove: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'fp-what-if',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
