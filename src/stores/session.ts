import { create } from 'zustand'
import type { User } from '#/features/auth/api/types'

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

type SessionState = {
  status: SessionStatus
  user: User | null
  setUser: (user: User) => void
  clear: () => void
}

/**
 * The session mirrors the HTTP-only auth cookie, which JS cannot read. Truth comes from
 * `GET /auth/me` on app start; this store just caches the resolved user for the UI.
 */
export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  setUser: (user) => set({ user, status: 'authenticated' }),
  clear: () => set({ user: null, status: 'anonymous' }),
}))
