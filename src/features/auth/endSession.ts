import { clearLocalDb } from '#/db/db'
import { useSessionStore } from '#/stores/session'

/**
 * The one way a session ends, whether the user signed out or the server refused to renew
 * the cookie. Turning the session anonymous is what routes the user out: every protected
 * route renders a redirect to login on that status. Callers holding a router may navigate
 * on top of it for immediacy.
 */
export async function endSession(): Promise<void> {
  useSessionStore.getState().clear()
  // Wipe local data so the next user on this device starts clean.
  await clearLocalDb().catch(() => undefined)
}
