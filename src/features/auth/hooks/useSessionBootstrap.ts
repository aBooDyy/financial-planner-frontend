import { useEffect } from 'react'
import { verifySession } from '../verifySession'
import { watchUnverifiedSession } from '../watchUnverifiedSession'

/**
 * Resolves the session on app start by asking the backend who the cookie belongs to, and keeps
 * asking on reconnect while the answer has only been the device's cached user.
 */
export function useSessionBootstrap() {
  useEffect(() => {
    void verifySession()
    return watchUnverifiedSession()
  }, [])
}
