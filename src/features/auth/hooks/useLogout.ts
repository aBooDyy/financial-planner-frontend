import { useNavigate } from '@tanstack/react-router'
import { clearLocalDb } from '#/db/db'
import { useSessionStore } from '#/stores/session'
import { authApi } from '../api/authApi'

export function useLogout() {
  const navigate = useNavigate()
  const clear = useSessionStore((s) => s.clear)

  return async () => {
    try {
      await authApi.logout()
    } finally {
      clear()
      // Wipe local data so the next user on this device starts clean.
      await clearLocalDb().catch(() => undefined)
      await navigate({ to: '/auth/login' })
    }
  }
}
