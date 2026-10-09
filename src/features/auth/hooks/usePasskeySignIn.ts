import { useState } from 'react'
import { WebAuthnAbortService } from '@simplewebauthn/browser'
import {
  isCeremonyCancelled,
  signInErrorMessage,
} from '#/features/passkeys/data/ceremony'
import { signInWithPasskey } from '../passkeySignIn'
import { useEnterApp } from './useEnterApp'

/** The "Sign in with Face ID" button. Closing the passkey sheet says nothing. */
export function usePasskeySignIn() {
  const enter = useEnterApp()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    // The email field's autofill request holds the one ceremony a page may run.
    WebAuthnAbortService.cancelCeremony()
    setError(null)
    setPending(true)
    try {
      await enter(await signInWithPasskey())
    } catch (err) {
      if (!isCeremonyCancelled(err)) setError(signInErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return { start, pending, error }
}
