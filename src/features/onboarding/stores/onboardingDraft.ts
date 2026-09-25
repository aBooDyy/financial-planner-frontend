import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CurrencyCode } from '#/lib/currency'
import { DEFAULT_CURRENCY } from '../data/currencies'
import { toggleSlug } from '../data/packs'
import type { IntentId, PackId } from '../data/packs'

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6

export const LAST_STEP: OnboardingStep = 6

type DraftFields = {
  /** Whose draft this is — a different signed-in user starts fresh. */
  userId: string | null
  step: OnboardingStep
  name: string
  intents: IntentId[]
  /** An explicit pack pick; null follows the suggestion the goals make. */
  packId: PackId | null
  /** Hand-edited categories; null means "exactly the active pack". */
  selection: string[] | null
  currency: CurrencyCode
}

type DraftState = DraftFields & {
  start: (userId: string, name: string) => void
  clear: () => void
  goTo: (step: OnboardingStep) => void
  setName: (name: string) => void
  toggleIntent: (id: IntentId) => void
  pickPack: (id: PackId) => void
  toggleCategory: (slug: string, current: string[]) => void
  resetSelection: () => void
  setCurrency: (code: CurrencyCode) => void
}

const blank = (userId: string | null, name: string): DraftFields => ({
  userId,
  step: 1,
  name,
  intents: [],
  packId: null,
  selection: null,
  currency: DEFAULT_CURRENCY,
})

/**
 * The first-run choices, held until the last step commits them. Kept in sessionStorage so
 * the wizard survives the email-sync OAuth round trip, which leaves the app entirely.
 */
export const useOnboardingDraft = create<DraftState>()(
  persist(
    (set) => ({
      ...blank(null, ''),
      start: (userId, name) => set(blank(userId, name)),
      clear: () => set(blank(null, '')),
      goTo: (step) => set({ step }),
      setName: (name) => set({ name }),
      toggleIntent: (id) =>
        set((s) => ({
          intents: s.intents.includes(id)
            ? s.intents.filter((i) => i !== id)
            : [...s.intents, id],
          packId: null,
          selection: null,
        })),
      pickPack: (packId) => set({ packId, selection: null }),
      toggleCategory: (slug, current) =>
        set({ selection: toggleSlug(current, slug) }),
      resetSelection: () => set({ selection: null }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'fp-onboarding-draft',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s): DraftFields => ({
        userId: s.userId,
        step: s.step,
        name: s.name,
        intents: s.intents,
        packId: s.packId,
        selection: s.selection,
        currency: s.currency,
      }),
    },
  ),
)
