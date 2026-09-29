import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'

type ThemeState = {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches

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

// Keeps `system` in step with the OS switching light/dark while the app is open.
export const followSystemTheme = (): (() => void) => {
  const query = window.matchMedia(DARK_QUERY)
  const onChange = () => {
    if (useThemeStore.getState().preference === 'system') applyStoredTheme()
  }
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
