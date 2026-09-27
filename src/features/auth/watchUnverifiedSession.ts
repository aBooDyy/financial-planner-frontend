import { usePullStateStore } from '#/db/pullState'
import { useSessionStore } from '#/stores/session'
import { verifySession } from './verifySession'

/**
 * Re-asks the server about a session that opened from the device's cache, as soon as the
 * server looks reachable: the browser coming back online, or a sync pull succeeding — the
 * latter covers a server that was down while the network was up, which fires no `online`.
 * A confirmed session needs no watching: its expiry reaches the sync engine's own refresh.
 * Returns the unsubscribe.
 */
export function watchUnverifiedSession(): () => void {
  const recheck = () => {
    const { status, verified } = useSessionStore.getState()
    if (status === 'authenticated' && !verified) void verifySession()
  }
  window.addEventListener('online', recheck)
  const unsubscribePulls = usePullStateStore.subscribe((next, prev) => {
    if (next.plannerInputsPulled > prev.plannerInputsPulled) recheck()
  })
  return () => {
    window.removeEventListener('online', recheck)
    unsubscribePulls()
  }
}
