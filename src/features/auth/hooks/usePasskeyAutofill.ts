import { useEffect, useState } from 'react'
import {
  WebAuthnAbortService,
  browserSupportsWebAuthnAutofill,
} from '@simplewebauthn/browser'
import {
  isCeremonyCancelled,
  signInErrorMessage,
} from '#/features/passkeys/data/ceremony'
import { signInWithPasskey } from '../passkeySignIn'
import { useEnterApp } from './useEnterApp'

/**
 * Offers the device's passkeys in the email field's autofill while the login form is open.
 * The request is dropped when the form goes away, goes offline, or the passkey button starts
 * its own.
 */
export function usePasskeyAutofill(online: boolean) {
  const enter = useEnterApp()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!online) return
    let cancelled = false
    const live = () => !cancelled
    const run = async () => {
      if (!(await browserSupportsWebAuthnAutofill()) || !live()) return
      const user = await signInWithPasskey(true)
      if (live()) await enter(user)
    }
    run().catch((err: unknown) => {
      if (live() && !isCeremonyCancelled(err)) setError(signInErrorMessage(err))
    })
    return () => {
      cancelled = true
      WebAuthnAbortService.cancelCeremony()
    }
  }, [online])

  return error
}
