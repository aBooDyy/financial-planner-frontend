import { useNavigate } from '@tanstack/react-router'
import { authApi } from '../api/authApi'
import { endSession } from '../endSession'

export function useLogout() {
  const navigate = useNavigate()

  return async () => {
    try {
      await authApi.logout()
    } finally {
      await endSession()
      await navigate({ to: '/auth/login' })
    }
  }
}
