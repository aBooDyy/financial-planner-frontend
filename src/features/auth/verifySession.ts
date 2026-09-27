import { clearLocalDb } from '#/db/db'
import { ApiError } from '#/lib/apiError'
import { useSessionStore } from '#/stores/session'
import { authApi } from './api/authApi'
import { endSession } from './endSession'

/**
 * The server's verdict that the cookie names no session. `http` has already tried a refresh
 * by the time a `401` gets here; a refresh it could not even send surfaces as a network error.
 */
const isRefused = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403)

let inFlight: Promise<void> | null = null

/**
 * Asks the server who the cookie belongs to and settles the session on the answer. Only a
 * refusal signs out. Failing to ask — offline, a timeout, throttling, a 5xx — keeps the
 * device's cached user, or leaves the session anonymous when there is none. Single-flight: the
 * boot check and a reconnect can ask at the same moment.
 */
export function verifySession(): Promise<void> {
  inFlight ??= runVerification().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runVerification(): Promise<void> {
  const shown = useSessionStore.getState().user
  // An answer about a session that ended or changed while the request was out is dropped.
  const stillShown = () => useSessionStore.getState().user === shown
  try {
    const user = await authApi.me()
    if (!stillShown()) return
    // The local tables belong to the cached user; the cookie now names someone else.
    if (shown && shown.id !== user.id) {
      await clearLocalDb().catch(() => undefined)
    }
    useSessionStore.getState().setUser(user)
  } catch (error) {
    if (!stillShown()) return
    if (isRefused(error)) await endSession()
    else if (!shown) useSessionStore.getState().clear()
  }
}
