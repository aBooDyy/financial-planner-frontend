import { ApiError } from '#/lib/apiError'
import { messageForApiError } from '#/lib/errorMessages'

/**
 * The user closed the browser's passkey sheet, or another ceremony replaced this one. Browsers
 * report both a refusal and a timeout as `NotAllowedError` on purpose, so none of them is an
 * error worth showing.
 */
export const isCeremonyCancelled = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'NotAllowedError' || error.name === 'AbortError')

export const hasCode = (error: unknown, code: string): boolean =>
  error instanceof ApiError && error.code === code

const isPreviouslyRegistered = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED'

export function signInErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return messageForApiError(error)
  return 'Couldn’t use your passkey. Try again, or sign in with your password.'
}

export function registrationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return messageForApiError(error)
  if (isPreviouslyRegistered(error))
    return 'This device already has a passkey for your account.'
  return 'Couldn’t set up the passkey. Try again.'
}
