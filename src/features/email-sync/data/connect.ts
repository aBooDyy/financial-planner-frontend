import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import type {
  EmailConnection,
  EmailProvider,
} from '#/features/email-sync/api/types'

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
  leaveFor((await emailSyncApi.authorizeUrl(provider)).authorize_url, returnTo)
}

/**
 * Sign an inbox the provider stopped honouring in again. The server keeps it — rules,
 * history and all — and refuses a different account; the user comes back to `returnTo`.
 */
export async function beginInboxReconnect(
  connection: Pick<EmailConnection, 'id' | 'provider'>,
  returnTo: string,
): Promise<void> {
  const { authorize_url } = await emailSyncApi.authorizeUrl(
    connection.provider,
    connection.id,
  )
  leaveFor(authorize_url, returnTo)
}

function leaveFor(authorizeUrl: string, returnTo: string): void {
  try {
    sessionStorage.setItem(RETURN_KEY, returnTo)
  } catch {
    // Storage blocked: the callback falls back to Settings.
  }
  window.location.assign(authorizeUrl)
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
 * Back in Settings, an inbox with no rules opens straight onto its first one — it reads
 * nothing until it has one. One that already has rules (signed in again) returns to the list,
 * as does anywhere else (first-run setup) with the path unchanged.
 */
export function connectedReturnUrl(
  path: string,
  connection: Pick<EmailConnection, 'id' | 'rules'> | null,
): string {
  if (path !== SETTINGS_PATH || !connection || connection.rules.length > 0) {
    return path
  }
  const params = new URLSearchParams({ inbox: connection.id, fresh: '1' })
  return `${path}?${params.toString()}`
}
