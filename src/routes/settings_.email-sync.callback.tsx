import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Splash } from '#/components/Splash'
import {
  connectedReturnUrl,
  takeConnectReturnPath,
} from '#/features/email-sync/data/connect'
import { completeOAuth } from '#/features/email-sync/data/mutations'
import { messageForApiError } from '#/lib/errorMessages'

export const Route = createFileRoute('/settings_/email-sync/callback')({
  component: EmailSyncCallback,
})

type Failure = { message: string; returnPath: string }

/**
 * Where the provider redirects back after consent. The trailing underscore on `settings_`
 * keeps the URL `/settings/email-sync/callback` (what the provider apps whitelist) while
 * un-nesting this route from the `/settings` layout — otherwise it would render inside the
 * Settings page's Outlet (which doesn't exist) and never mount.
 *
 * Exchanges the `code` for tokens (server-side) to create or re-sign the connection, then
 * returns to where the connect began — by default Settings → Email sync, opened on a new
 * inbox's first rule. A cancelled consent goes straight back; a refused one says why first.
 */
function EmailSyncCallback() {
  const ran = useRef(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const returnPath = takeConnectReturnPath()

    const finish = async () => {
      if (!code || !state) {
        window.location.assign(returnPath)
        return
      }
      try {
        const connection = await completeOAuth(code, state)
        window.location.assign(connectedReturnUrl(returnPath, connection))
      } catch (error) {
        setFailure({ message: messageForApiError(error), returnPath })
      }
    }
    void finish()
  }, [])

  if (!failure) return <Splash />

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-fp-bg px-6 text-center text-fp-text">
      <p className="max-w-sm text-[14.5px] text-fp-text-2">{failure.message}</p>
      <a
        href={failure.returnPath}
        className="font-bold text-fp-accent-ink hover:underline"
      >
        Go back
      </a>
    </div>
  )
}
