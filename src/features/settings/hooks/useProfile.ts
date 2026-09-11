import { useState } from 'react'
import { authApi } from '#/features/auth/api/authApi'
import { messageForApiError } from '#/lib/errorMessages'
import { useSessionStore } from '#/stores/session'

type SaveState = { saving: boolean; error: string | null; saved: boolean }

/**
 * Profile editing. Unlike the local-first domain entities, the user identity lives on the
 * server (the app reads it from `GET /auth/me`), so a save is a direct online call; on
 * success the session cache is refreshed so the whole UI (avatar, menu) updates at once.
 */
export function useProfile() {
  const user = useSessionStore((s) => s.user)
  const setUser = useSessionStore((s) => s.setUser)
  const [state, setState] = useState<SaveState>({
    saving: false,
    error: null,
    saved: false,
  })

  const save = async (name: string, email: string): Promise<boolean> => {
    if (!user) return false
    setState({ saving: true, error: null, saved: false })
    try {
      const updated = await authApi.updateProfile({
        version: user.version,
        name,
        email,
      })
      setUser(updated)
      setState({ saving: false, error: null, saved: true })
      return true
    } catch (e) {
      setState({ saving: false, error: messageForApiError(e), saved: false })
      return false
    }
  }

  return { ...state, save }
}
