import { useEffect } from 'react'
import { useSessionStore } from '#/stores/session'
import { runEmailSync } from '#/features/email-sync/data/mutations'

let started = false

/**
 * Once per app load, after the session resolves, run a client-triggered email scan (and pull
 * its results into the local cache). A backend cron is a later add; for now login is the
 * trigger. Failures are swallowed — email sync must never block the app.
 */
export function useEmailSyncBootstrap(): void {
  const status = useSessionStore((s) => s.status)

  useEffect(() => {
    if (status !== 'authenticated' || started) return
    started = true
    void runEmailSync().catch(() => undefined)
  }, [status])
}
