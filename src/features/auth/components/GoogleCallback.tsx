import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Splash } from '#/components/Splash'
import { clearLocalDb } from '#/db/db'
import { authApi } from '#/features/auth/api/authApi'
import {
  clearResumeSetup,
  markJustSignedIn,
  resumeSetupPending,
} from '#/features/passkeys/data/setupFlags'
import { messageForApiError } from '#/lib/errorMessages'
import { useSessionStore } from '#/stores/session'

/**
 * Where Google redirects back after consent. Exchanges the `code` for a session (server-side,
 * which sets the auth cookies), caches the user, and lands on the app — or shows an error with
 * a way back to login if the round-trip failed. A round trip made to re-verify before adding a
 * passkey lands back on Settings › Sign-in & security instead, which carries the setup on.
 */
export function GoogleCallback() {
  const ran = useRef(false)
  const navigate = useNavigate()
  const setUser = useSessionStore((s) => s.setUser)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const resuming = resumeSetupPending()

    const finish = async () => {
      if (!code || !state) {
        clearResumeSetup()
        setError('Sign-in was cancelled or the link was incomplete.')
        return
      }
      try {
        const shown = useSessionStore.getState().user
        const user = await authApi.googleCallback(code, state)
        // Re-verifying from inside the app can come back as another account; the local
        // tables belong to the one that left.
        if (shown && shown.id !== user.id) {
          await clearLocalDb().catch(() => undefined)
        }
        setUser(user)
        if (resuming && shown?.id === user.id) {
          await navigate({ to: '/settings/security' })
          return
        }
        clearResumeSetup()
        markJustSignedIn(user.id)
        await navigate({ to: '/' })
      } catch (err) {
        clearResumeSetup()
        setError(messageForApiError(err))
      }
    }
    void finish()
  }, [navigate, setUser])

  if (!error) return <Splash />

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-fp-bg px-6 text-center text-fp-text">
      <p className="max-w-sm text-[14.5px] text-fp-text-2">{error}</p>
      <Link
        to="/auth/login"
        className="font-bold text-fp-accent-ink hover:underline"
      >
        Back to login
      </Link>
    </div>
  )
}
