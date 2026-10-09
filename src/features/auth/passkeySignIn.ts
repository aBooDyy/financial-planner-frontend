import { startAuthentication } from '@simplewebauthn/browser'
import type { User } from '#/features/auth/api/types'
import { passkeysApi } from '#/features/passkeys/api/passkeysApi'

/**
 * Options, the browser's passkey sheet, then the server's check. With `autofill` the sheet
 * waits behind the email field's suggestions instead of opening.
 */
export async function signInWithPasskey(autofill = false): Promise<User> {
  const { options, state } = await passkeysApi.authenticationOptions()
  const credential = await startAuthentication({
    optionsJSON: options,
    useBrowserAutofill: autofill,
  })
  return passkeysApi.authenticationVerify({ state, credential })
}
