import { useEffect } from 'react'
import { useSessionStore } from '#/stores/session'
import { startSync } from './sync'

/**
 * Runs the sync engine for as long as there is a session, from the root layout — the one
 * component navigation does not unmount. Sync is app-wide: a pull refreshes every
 * collection at once, so starting it per page would refetch the whole dataset on every
 * route change, most of it for pages the user is not looking at.
 */
export function useSync(): void {
  const authenticated = useSessionStore((s) => s.status === 'authenticated')

  useEffect(() => {
    if (!authenticated) return
    return startSync()
  }, [authenticated])
}
