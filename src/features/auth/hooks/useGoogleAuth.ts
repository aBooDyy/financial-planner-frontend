import { useState } from 'react'
import { messageForApiError } from '#/lib/errorMessages'
import { authApi } from '../api/authApi'

/**
 * "Sign in with Google": ask the backend for the consent URL, then hand the browser off to
 * Google. Consent returns to `/auth/google/callback`, which completes the sign-in.
 */
export function useGoogleAuth() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setError(null)
    setPending(true)
    try {
      const { authorize_url } = await authApi.googleAuthorizeUrl()
      window.location.assign(authorize_url)
    } catch (err) {
      setPending(false)
      setError(messageForApiError(err))
    }
  }

  return { start, pending, error }
}
