import { useEffect } from 'react'
import { useSessionStore } from '#/stores/session'
import { runEmailSync } from '#/features/email-sync/data/mutations'

let started = false

/**
 * Once per app load, after the server confirms the session, run a client-triggered email scan
 * (and pull its results into the local cache). A backend cron is a later add; for now login is
 * the trigger. A session opened offline from the device's cache is confirmed once the server
 * is reachable, so the load's one scan is not spent while it would fail.
 * Failures are swallowed — email sync must never block the app.
 */
export function useEmailSyncBootstrap(): void {
  const verified = useSessionStore((s) => s.verified)

  useEffect(() => {
    if (!verified || started) return
    started = true
    void runEmailSync().catch(() => undefined)
  }, [verified])
}
