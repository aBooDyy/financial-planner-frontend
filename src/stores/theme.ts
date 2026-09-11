import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'

type ThemeState = {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

const resolve = (preference: ThemePreference): 'light' | 'dark' =>
  preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference

const applyToDocument = (preference: ThemePreference) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(
    'dark',
    resolve(preference) === 'dark',
  )
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => {
        applyToDocument(preference)
        set({ preference })
      },
    }),
    {
      name: 'fp-theme',
      onRehydrateStorage: () => (state) =>
        applyToDocument(state?.preference ?? 'system'),
    },
  ),
)

export const applyStoredTheme = () =>
  applyToDocument(useThemeStore.getState().preference)
