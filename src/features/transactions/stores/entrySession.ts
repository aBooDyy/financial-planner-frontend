import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Scope } from '#/features/transactions/data/selectors'

/** Away from the app for longer than this, the next visit starts from the defaults again. */
export const SESSION_IDLE_MS = 60 * 60 * 1000

type Remembered = {
  /** The wallet the last new entry went to — a transfer's source. */
  walletId: string | null
  toWalletId: string | null
  /** A day other than the one it was picked on; null follows today. */
  date: string | null
  /** The Spending page's account filter. */
  scope: Scope | null
  /** When the app was last in use. */
  seenAt: number
}

type EntrySessionState = Remembered & {
  rememberEntry: (entry: {
    walletId: string
    /** A transfer's destination; a spend or income leaves the last one as it was. */
    toWalletId?: string
    date: string
    today: string
  }) => void
  rememberScope: (scope: Scope) => void
  markSeen: () => void
  forgetIfIdle: () => void
}

const blank = (): Remembered => ({
  walletId: null,
  toWalletId: null,
  date: null,
  scope: null,
  seenAt: Date.now(),
})

/**
 * What the user was just doing — the wallet and day of their last new entry, the Spending
 * filter — so a run of entries doesn't re-pick them. Kept in sessionStorage, which a closed
 * home-screen app loses, and dropped after a long time away.
 */
export const useEntrySession = create<EntrySessionState>()(
  persist(
    (set, get) => ({
      ...blank(),
      rememberEntry: ({ walletId, toWalletId, date, today }) =>
        set((s) => ({
          walletId,
          toWalletId: toWalletId ?? s.toWalletId,
          date: date === today ? null : date,
          seenAt: Date.now(),
        })),
      rememberScope: (scope) => set({ scope, seenAt: Date.now() }),
      markSeen: () => set({ seenAt: Date.now() }),
      forgetIfIdle: () => {
        if (Date.now() - get().seenAt > SESSION_IDLE_MS) set(blank())
      },
    }),
    {
      name: 'fp-entry-session',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

if (typeof document !== 'undefined') {
  useEntrySession.getState().forgetIfIdle()
  // While the app is on screen it is in use; the clock only runs while it is away.
  document.addEventListener('visibilitychange', () => {
    const session = useEntrySession.getState()
    if (document.visibilityState === 'hidden') session.markSeen()
    else session.forgetIfIdle()
  })
}
