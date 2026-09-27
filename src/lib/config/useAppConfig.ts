import { useEffect, useRef } from 'react'
import { usePreferencesStore } from '#/stores/preferences'
import { useSessionStore } from '#/stores/session'
import { useAppConfigStore } from './appConfig'
import { configApi } from './configApi'
import { loadCachedConfig, saveCachedConfig } from './configCache'

/**
 * Fills in the app config once, from the root layout. Order: the bundled snapshot the
 * store already starts from, then the cached Dexie row, then a background refresh — so
 * nothing here blocks first paint and a failed fetch is silent. This is the one place
 * where a stale value is strictly better than an error.
 */
export function useAppConfig(): void {
  const verified = useSessionStore((s) => s.verified)
  const autoUpdateRates = usePreferencesStore((s) => s.autoUpdateRates)
  const refreshed = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    void (async () => {
      const cached = await loadCachedConfig()
      if (!mounted.current || refreshed.current || !cached) return
      useAppConfigStore.getState().applyConfig(cached)
    })()
    return () => {
      mounted.current = false
    }
  }, [])

  // `GET /config` is authenticated, so the refresh waits for the server to confirm a session
  // and re-runs when a new one starts (a user who just signed in on a fresh device has only
  // the snapshot). A session opened offline from the device's cache is confirmed once the
  // server is reachable again, which is when a refresh can succeed. It also re-runs when the
  // rates preference flips, which is what lets turning auto-update back on adopt the rates the
  // last refresh was told to leave alone.
  useEffect(() => {
    if (!verified) return
    void (async () => {
      try {
        const fresh = await configApi.get()
        if (!mounted.current) return
        refreshed.current = true
        const store = useAppConfigStore.getState()
        store.applyConfig(fresh, !autoUpdateRates)
        // What is cached is what is in use, so a reload offline converts at the same rates.
        await saveCachedConfig(useAppConfigStore.getState().config)
      } catch {
        // Offline or unreachable: the cached or bundled config stands.
      }
    })()
  }, [verified, autoUpdateRates])
}
