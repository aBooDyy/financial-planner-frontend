import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Privacy mode hides money figures so the app can be opened in public. Persisted, so an app
 * reopened on a bus stays hidden until the user reveals it.
 */
type PrivacyState = {
  hidden: boolean
  toggle: () => void
}

const applyToDocument = (hidden: boolean) => {
  if (typeof document === 'undefined') return
  document.documentElement.toggleAttribute('data-privacy', hidden)
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set, get) => ({
      hidden: false,
      toggle: () => {
        const hidden = !get().hidden
        applyToDocument(hidden)
        set({ hidden })
      },
    }),
    {
      name: 'fp-privacy',
      onRehydrateStorage: () => (state) =>
        applyToDocument(state?.hidden ?? false),
    },
  ),
)
