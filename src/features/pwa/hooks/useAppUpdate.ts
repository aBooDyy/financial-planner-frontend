import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { watchForUpdates } from '../watchForUpdates'

export type AppUpdate = {
  /** A newer version is installed and this tab is still running the old one. */
  updateReady: boolean
  /** Switches to the new version. Only ever called by the user: a reload loses an open form. */
  reload: () => void
  /** Hides the prompt; the new version then starts on the next launch. */
  dismiss: () => void
}

/** Registers the service worker and reports when a new release is waiting to take over. */
export function useAppUpdate(): AppUpdate {
  const stopWatching = useRef<(() => void) | null>(null)
  const reloadRequested = useRef(false)
  // Set when another tab took the update: this tab keeps its page, now on a stale bundle.
  const [takenElsewhere, setTakenElsewhere] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_swUrl, registration) => {
      if (registration) stopWatching.current = watchForUpdates(registration)
    },
    // Without this the plugin reloads every open tab the moment one of them updates.
    onNeedReload: () => {
      if (reloadRequested.current) window.location.reload()
      else setTakenElsewhere(true)
    },
  })

  useEffect(() => () => stopWatching.current?.(), [])

  const reload = () => {
    if (takenElsewhere) {
      window.location.reload()
      return
    }
    reloadRequested.current = true
    void updateServiceWorker()
  }

  const dismiss = () => {
    setNeedRefresh(false)
    setTakenElsewhere(false)
  }

  return { updateReady: needRefresh || takenElsewhere, reload, dismiss }
}
