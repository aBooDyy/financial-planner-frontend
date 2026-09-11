import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Direction = 'ltr' | 'rtl'
export type Locale = 'en' | 'ar'

const DIRECTION_BY_LOCALE: Record<Locale, Direction> = { en: 'ltr', ar: 'rtl' }

type DirectionState = {
  locale: Locale
  direction: Direction
  setLocale: (locale: Locale) => void
}

const applyToDocument = (locale: Locale, direction: Direction) => {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.documentElement.dir = direction
}

export const useDirectionStore = create<DirectionState>()(
  persist(
    (set) => ({
      locale: 'en',
      direction: 'ltr',
      setLocale: (locale) => {
        const direction = DIRECTION_BY_LOCALE[locale]
        applyToDocument(locale, direction)
        set({ locale, direction })
      },
    }),
    {
      name: 'fp-direction',
      onRehydrateStorage: () => (state) => {
        const locale = state?.locale ?? 'en'
        applyToDocument(locale, DIRECTION_BY_LOCALE[locale])
      },
    },
  ),
)

export const applyStoredDirection = () => {
  const { locale, direction } = useDirectionStore.getState()
  applyToDocument(locale, direction)
}
