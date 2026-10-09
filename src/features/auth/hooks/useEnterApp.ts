import { useNavigate } from '@tanstack/react-router'
import type { User } from '#/features/auth/api/types'
import { useSessionStore } from '#/stores/session'

/** Lands a sign-in the way every sign-in lands: the session first, then the app. */
export function useEnterApp() {
  const navigate = useNavigate()
  const setUser = useSessionStore((s) => s.setUser)
  return async (user: User) => {
    setUser(user)
    await navigate({ to: '/' })
  }
}
