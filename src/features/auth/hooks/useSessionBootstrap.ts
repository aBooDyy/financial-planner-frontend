import { useEffect } from 'react'
import { useSessionStore } from '#/stores/session'
import { authApi } from '../api/authApi'

let started = false

/** Resolves the session once on app start by asking the backend who the cookie belongs to. */
export function useSessionBootstrap() {
  const setUser = useSessionStore((s) => s.setUser)
  const clear = useSessionStore((s) => s.clear)

  useEffect(() => {
    if (started) return
    started = true
    authApi
      .me()
      .then(setUser)
      .catch(() => clear())
  }, [setUser, clear])
}
