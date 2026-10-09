/**
 * The device-local flags that decide when passkey setup is offered. Storage can be blocked or
 * full; a flag that can't be read or written only means the offer comes or goes once more.
 */

const JUST_SIGNED_IN = 'fp:passkey-just-signed-in'
const RESUME_SETUP = 'fp:passkey-resume-setup'
const dismissedKey = (userId: string) => `fp:passkey-prompt-dismissed:${userId}`

const read = (storage: () => Storage, key: string): string | null => {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

const write = (storage: () => Storage, key: string, value: string): void => {
  try {
    storage().setItem(key, value)
  } catch {
    // See the module note.
  }
}

const remove = (storage: () => Storage, key: string): void => {
  try {
    storage().removeItem(key)
  } catch {
    // See the module note.
  }
}

const session = () => globalThis.sessionStorage
const local = () => globalThis.localStorage

/** Set by a password or Google sign-in and by sign-up; never by a passkey or a restored session. */
export const markJustSignedIn = (userId: string): void =>
  write(session, JUST_SIGNED_IN, userId)

export const justSignedIn = (userId: string): boolean =>
  read(session, JUST_SIGNED_IN) === userId

export const clearJustSignedIn = (): void => remove(session, JUST_SIGNED_IN)

export const markPromptDismissed = (userId: string): void =>
  write(local, dismissedKey(userId), '1')

export const promptDismissed = (userId: string): boolean =>
  read(local, dismissedKey(userId)) !== null

/** Set before leaving for Google to re-verify, so setup carries on when the app comes back. */
export const markResumeSetup = (): void => write(session, RESUME_SETUP, '1')

export const resumeSetupPending = (): boolean =>
  read(session, RESUME_SETUP) !== null

export const clearResumeSetup = (): void => remove(session, RESUME_SETUP)
