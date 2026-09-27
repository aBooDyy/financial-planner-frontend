import { useEffect } from 'react'
import { useSessionStore } from '#/stores/session'
import { requestPersistentStorage } from '../persistentStorage'

/** Requests persistent storage once someone is signed in, when there is data worth keeping. */
export function usePersistentStorage(): void {
  const signedIn = useSessionStore((s) => s.status === 'authenticated')
  useEffect(() => {
    if (signedIn) void requestPersistentStorage()
  }, [signedIn])
}
