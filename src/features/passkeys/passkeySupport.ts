import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser'

/** What this device's own authenticator is called, as it reads after "Sign in with". */
export type PlatformLabel = 'Face ID' | 'Touch ID' | 'a passkey'

type Device = { userAgent: string; maxTouchPoints: number }

/**
 * iPadOS reports a Mac user agent; only the touch screen tells the two apart. Which Apple
 * device has Face ID rather than Touch ID isn't knowable from here, so the label follows the
 * common case for each.
 */
export function platformLabel(device: Device = navigator): PlatformLabel {
  const ua = device.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'Face ID'
  if (/Macintosh|Mac OS X/.test(ua))
    return device.maxTouchPoints > 1 ? 'Face ID' : 'Touch ID'
  return 'a passkey'
}

export const signInLabel = (label: PlatformLabel): string =>
  `Sign in with ${label}`

export const setUpLabel = (label: PlatformLabel): string => `Set up ${label}`

/** Whether this browser can run a WebAuthn ceremony at all — a phone nearby or a key counts. */
export const passkeysSupported = (): boolean => browserSupportsWebAuthn()

/** Whether the device itself can hold a passkey behind a biometric or its screen lock. */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return await platformAuthenticatorIsAvailable()
  } catch {
    return false
  }
}
