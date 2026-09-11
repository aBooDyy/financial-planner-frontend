import { useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Splash } from '#/components/Splash'
import { completeOAuth } from '#/features/email-sync/data/mutations'

export const Route = createFileRoute('/settings_/email-sync/callback')({
  component: EmailSyncCallback,
})

/**
 * Where the provider redirects back after consent. The trailing underscore on `settings_`
 * keeps the URL `/settings/email-sync/callback` (what the provider apps whitelist) while
 * un-nesting this route from the `/settings` layout — otherwise it would render inside the
 * Settings page's Outlet (which doesn't exist) and never mount.
 *
 * Exchanges the `code` for tokens (server-side) to create the connection, then hands off to
 * Settings → Email sync, which resumes the wizard at the "select senders" step.
 */
function EmailSyncCallback() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    const finish = async () => {
      if (code && state) {
        try {
          await completeOAuth(code, state)
        } catch {
          // Fall through — Settings shows the idle/error state.
        }
      }
      window.location.assign('/settings?section=email')
    }
    void finish()
  }, [])

  return <Splash />
}
