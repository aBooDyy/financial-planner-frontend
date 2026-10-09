import { useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { useGoogleAuth } from '#/features/auth/hooks/useGoogleAuth'
import { passkeysApi } from '#/features/passkeys/api/passkeysApi'
import type { Passkey } from '#/features/passkeys/api/types'
import {
  hasCode,
  isCeremonyCancelled,
  registrationErrorMessage,
} from '#/features/passkeys/data/ceremony'
import {
  clearResumeSetup,
  markResumeSetup,
} from '#/features/passkeys/data/setupFlags'
import { useSessionStore } from '#/stores/session'

/**
 * Where adding a passkey stands. `password` and `google` ask the user to prove it's them
 * because the session is no longer fresh; `done` is a passkey that landed.
 */
export type RegistrationPhase = 'idle' | 'password' | 'google' | 'done'

const WRONG_PASSWORD = 'That password isn’t right. Try again.'

export type PasskeyRegistration = {
  phase: RegistrationPhase
  busy: boolean
  error: string | null
  start: () => void
  confirmPassword: (password: string) => void
  verifyWithGoogle: () => void
  googlePending: boolean
  reset: () => void
}

/**
 * Adds a passkey: options (re-authenticating first when the server asks), the browser's
 * passkey sheet, then the server's check. Closing the sheet leaves things as they were.
 */
export function usePasskeyRegistration(
  onAdded: (passkey: Passkey) => void,
): PasskeyRegistration {
  const [phase, setPhase] = useState<RegistrationPhase>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const google = useGoogleAuth()

  const optionsFor = async (password?: string) => {
    try {
      return await passkeysApi.registrationOptions(password)
    } catch (err) {
      if (hasCode(err, 'auth.reauth.required')) {
        const hasPassword = useSessionStore.getState().user?.hasPassword
        setPhase(hasPassword ? 'password' : 'google')
      } else {
        setError(
          hasCode(err, 'auth.credentials.invalid')
            ? WRONG_PASSWORD
            : registrationErrorMessage(err),
        )
      }
      return null
    }
  }

  const register = async (password?: string) => {
    setBusy(true)
    setError(null)
    try {
      const options = await optionsFor(password)
      if (!options) return
      setPhase('idle')
      const credential = await startRegistration({
        optionsJSON: options.options,
      })
      const passkey = await passkeysApi.registrationVerify({
        state: options.state,
        credential,
      })
      onAdded(passkey)
      setPhase('done')
    } catch (err) {
      if (!isCeremonyCancelled(err)) setError(registrationErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return {
    phase,
    busy,
    error: phase === 'google' ? (google.error ?? error) : error,
    start: () => void register(),
    confirmPassword: (password) => void register(password),
    verifyWithGoogle: () => {
      markResumeSetup()
      void google.start()
    },
    googlePending: google.pending,
    reset: () => {
      clearResumeSetup()
      setPhase('idle')
      setError(null)
    },
  }
}
