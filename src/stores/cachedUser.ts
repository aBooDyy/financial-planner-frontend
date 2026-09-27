import type { User } from '#/features/auth/api/types'

const KEY = 'fp-session-user'

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

const isUser = (value: unknown): value is User => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.email === 'string' &&
    typeof v.name === 'string' &&
    isNullableString(v.onboardedAt) &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string' &&
    typeof v.version === 'string'
  )
}

/**
 * The last user the server confirmed on this device, so a launch without a network still opens
 * signed in. Kept in localStorage rather than Dexie because it is read synchronously while the
 * session store is created: a device that has it renders the app on the first frame instead of
 * a splash that waits on IndexedDB. Storage that is blocked or holds a stale shape reads as
 * "nothing cached".
 */
export function readCachedUser(): User | null {
  try {
    const raw = globalThis.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeCachedUser(user: User): void {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(user))
  } catch {
    // Without the cache an offline launch lands on sign-in; the online session is unaffected.
  }
}

export function removeCachedUser(): void {
  try {
    globalThis.localStorage.removeItem(KEY)
  } catch {
    // Nothing was stored if storage is unavailable.
  }
}
