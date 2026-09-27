import { create } from 'zustand'
import type { User } from '#/features/auth/api/types'
import { readCachedUser, removeCachedUser, writeCachedUser } from './cachedUser'

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

type SessionState = {
  status: SessionStatus
  user: User | null
  /** False while the user shown is this device's cached copy the server has not confirmed yet. */
  verified: boolean
  setUser: (user: User) => void
  clear: () => void
}

const cached = readCachedUser()

/**
 * The session mirrors the HTTP-only auth cookie, which JS cannot read. A device that cached a
 * user starts signed in as them, unverified; `GET /auth/me` then confirms or ends it. Every
 * `setUser` carries a user the server just returned, so it is what the cache holds.
 */
export const useSessionStore = create<SessionState>((set) => ({
  status: cached ? 'authenticated' : 'loading',
  user: cached,
  verified: false,
  setUser: (user) => {
    writeCachedUser(user)
    set({ user, status: 'authenticated', verified: true })
  },
  clear: () => {
    removeCachedUser()
    set({ user: null, status: 'anonymous', verified: false })
  },
}))
