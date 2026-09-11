import { ApiError } from './apiError'

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

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
    details?: Array<{ field: string; code: string }>
  }
}

const isErrorEnvelope = (body: unknown): body is ErrorEnvelope =>
  typeof body === 'object' && body !== null && 'error' in body

async function request<T>(
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

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
