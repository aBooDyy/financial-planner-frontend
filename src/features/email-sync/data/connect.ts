import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import type { EmailProvider } from '#/features/email-sync/api/types'

const RETURN_KEY = 'fp.emailSync.returnTo'
export const SETTINGS_PATH = '/settings/email-sync'

/**
 * Leave for the provider's consent screen. The OAuth callback URL is fixed (the provider
 * apps whitelist it), so where the user started is carried across the round trip in
 * sessionStorage instead.
 */
export async function beginInboxConnect(
  provider: EmailProvider,
  returnTo: string = SETTINGS_PATH,
): Promise<void> {
  const { authorize_url } = await emailSyncApi.authorizeUrl(provider)
  try {
    sessionStorage.setItem(RETURN_KEY, returnTo)
  } catch {
    // Storage blocked: the callback falls back to Settings.
  }
  window.location.assign(authorize_url)
}

/** Where the callback sends the user, read once. Only same-origin paths are honoured. */
export function takeConnectReturnPath(): string {
  try {
    const path = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    if (path && path.startsWith('/') && !path.startsWith('//')) return path
  } catch {
    // Storage blocked.
  }
  return SETTINGS_PATH
}

/**
 * Back in Settings, a new inbox opens straight onto its first rule — it reads nothing until it
 * has one. Anywhere else (first-run setup) gets the path unchanged.
 */
export function connectedReturnUrl(
  path: string,
  connectionId: string | null,
): string {
  if (path !== SETTINGS_PATH || !connectionId) return path
  const params = new URLSearchParams({ inbox: connectionId, fresh: '1' })
  return `${path}?${params.toString()}`
}
