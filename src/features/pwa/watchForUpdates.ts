export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
export const MIN_CHECK_GAP_MS = 60 * 1000

/**
 * Asks the browser to re-fetch the service worker hourly, whenever the app returns to the
 * foreground, and when the network comes back, so an installed app that is never closed
 * still learns about a release. Returns a function that stops watching.
 */
export function watchForUpdates(
  registration: ServiceWorkerRegistration,
): () => void {
  let lastCheck = Date.now()

  const check = () => {
    if (!navigator.onLine || registration.installing) return
    if (Date.now() - lastCheck < MIN_CHECK_GAP_MS) return
    lastCheck = Date.now()
    // A failed check (server down, captive portal) is retried on the next trigger.
    registration.update().catch(() => {})
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') check()
  }

  const timer = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', check)

  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('online', check)
  }
}
