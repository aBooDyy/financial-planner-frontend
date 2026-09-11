import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Splash } from '#/components/Splash'
import { authApi } from '#/features/auth/api/authApi'
import { messageForApiError } from '#/lib/errorMessages'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/auth/google/callback')({
  component: GoogleCallback,
})

/**
 * Where Google redirects back after consent. Exchanges the `code` for a session (server-side,
 * which sets the auth cookies), caches the user, and lands on the app — or shows an error with
 * a way back to login if the round-trip failed.
 */
function GoogleCallback() {
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

    const finish = async () => {
      if (!code || !state) {
        setError('Sign-in was cancelled or the link was incomplete.')
        return
      }
      try {
        const user = await authApi.googleCallback(code, state)
        setUser(user)
        await navigate({ to: '/' })
      } catch (err) {
        setError(messageForApiError(err))
      }
    }
    void finish()
  }, [navigate, setUser])

  if (!error) return <Splash />

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-fp-bg px-6 text-center text-fp-text">
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
