import { endSession } from '#/features/auth/endSession'
import { useSessionStore } from '#/stores/session'
import { ApiError } from './apiError'

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

/** An absolute path on the server the app reaches the API on — for addresses a user copies. */
export const apiOriginUrl = (absolutePath: string): string =>
  new URL(absolutePath, new URL(BASE_URL, window.location.origin)).toString()

// Standard backend envelope: success carries `data`; error carries `error`. We read only
// those two fields, so the extra envelope keys (success/url/method/timestamp) are ignored.
type SuccessEnvelope<T> = {
  success: true
  data: T
  url?: string
  method?: string
}
type ErrorEnvelope = {
  success: false
  error: {
    code: string
    message: string
    details?: Array<{ field: string; code: string; value?: string }>
  }
}

const isErrorEnvelope = (body: unknown): body is ErrorEnvelope =>
  typeof body === 'object' && body !== null && 'error' in body

const REFRESH_PATH = '/auth/refresh'

/**
 * The paths the backend serves anonymously. A 401 from one of them is the answer itself —
 * bad credentials, a spent refresh cookie — not an expired access cookie, so refreshing
 * there would recurse (on `/auth/refresh`) or mask a real failure.
 */
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/register',
  '/auth/login',
  '/auth/logout',
  REFRESH_PATH,
  '/auth/google/authorize-url',
  '/auth/google/callback',
])

const isPublicAuthPath = (path: string): boolean =>
  PUBLIC_AUTH_PATHS.has(path.split('?')[0])

async function send<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      // The HTTP-only auth cookie rides along automatically; the app never reads the token.
      credentials: 'include',
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError({
      code: 'common.network',
      message: 'Network request failed.',
      status: 0,
    })
  }

  const payload: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)

  if (!response.ok) {
    if (isErrorEnvelope(payload)) {
      throw new ApiError({
        code: payload.error.code,
        message: payload.error.message,
        status: response.status,
        details: payload.error.details,
      })
    }
    throw new ApiError({
      code: 'common.unexpected',
      message: `Request failed (${response.status}).`,
      status: response.status,
    })
  }

  if (payload === undefined) return undefined as T
  return (payload as SuccessEnvelope<T>).data
}

let refreshing: Promise<void> | null = null

/**
 * Single-flight. The access cookie expires for every in-flight request at once — a sync
 * wave is a dozen parallel calls — and they must produce one refresh between them, not one
 * each. Whoever finds a refresh running awaits the same promise and retries behind it. The
 * slot is freed before waiters resume, so the *next* expiry gets its own refresh.
 */
function refreshSession(): Promise<void> {
  if (!refreshing) {
    refreshing = runRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function runRefresh(): Promise<void> {
  const userAtSend = useSessionStore.getState().user
  try {
    await send<unknown>('POST', REFRESH_PATH)
  } catch (error) {
    // Only the server saying "not authenticated" ends the session. Any other failure means
    // we could not ask: an offline client keeps its session and its unsynced local data.
    // The refusal judges the cookies this request carried, so a sign-in that landed while
    // it was out has newer ones and must survive it.
    const sessionReplaced = useSessionStore.getState().user !== userAtSend
    if (
      error instanceof ApiError &&
      error.isUnauthenticated &&
      !sessionReplaced
    ) {
      await endSession()
    }
    // The refresh failure replaces the caller's 401 deliberately — a transient one carries
    // `common.network`, which reads as "the server is unreachable", not as a verdict.
    throw error
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  try {
    return await send<T>(method, path, body)
  } catch (error) {
    const expired =
      error instanceof ApiError &&
      error.isUnauthenticated &&
      !isPublicAuthPath(path)
    if (!expired) throw error

    await refreshSession()
    // Retried outside the `try`, so a second 401 propagates instead of refreshing again.
    return await send<T>(method, path, body)
  }
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
