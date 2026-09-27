import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiError'
import { http } from './http'
import { useSessionStore } from '#/stores/session'
import type { User } from '#/features/auth/api/types'

/**
 * Silent token refresh. The access cookie lives 15 minutes; the refresh cookie 30 days.
 * Before this existed, a sync wave that outlived the access cookie produced a dozen 401s,
 * no refresh, and a UI that still looked signed in while every request failed forever.
 */

const { endSession } = vi.hoisted(() => ({ endSession: vi.fn() }))
vi.mock('#/features/auth/endSession', () => ({ endSession }))

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

type Reply = { status: number; body?: unknown } | 'network'

const unauthenticated: Reply = {
  status: 401,
  body: {
    success: false,
    error: { code: 'auth.unauthenticated', message: 'Not authenticated.' },
  },
}
const ok = (data: unknown): Reply => ({
  status: 200,
  body: { success: true, data },
})

let reply: (method: string, path: string) => Reply
const calls: Array<{ method: string; path: string }> = []

const countOf = (path: string) => calls.filter((c) => c.path === path).length

beforeEach(() => {
  calls.length = 0
  endSession.mockClear()
  endSession.mockResolvedValue(undefined)

  globalThis.fetch = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url).slice(BASE_URL.length)
      const method = init?.method ?? 'GET'
      calls.push({ method, path })
      // Let every concurrent caller reach its 401 before any reply resolves.
      await Promise.resolve()
      const answer = reply(method, path)
      if (answer === 'network') throw new TypeError('Failed to fetch')
      return {
        ok: answer.status >= 200 && answer.status < 300,
        status: answer.status,
        json: async () => answer.body,
      } as Response
    },
  )
})

describe('silent refresh', () => {
  it('refreshes once for a whole wave of parallel 401s, then retries them all', async () => {
    let refreshed = false
    reply = (_method, path) => {
      if (path === '/auth/refresh') {
        refreshed = true
        return ok({ id: 'u1' })
      }
      return refreshed ? ok([path]) : unauthenticated
    }

    const paths = Array.from({ length: 12 }, (_, i) => `/collection-${i}`)
    const results = await Promise.all(
      paths.map((p) => http.get<Array<string>>(p)),
    )

    expect(results).toEqual(paths.map((p) => [p]))
    expect(countOf('/auth/refresh')).toBe(1)
    // Each collection: the expired call, then the retry behind the shared refresh.
    for (const p of paths) expect(countOf(p)).toBe(2)
    expect(endSession).not.toHaveBeenCalled()
  })

  it('retries once and then surfaces a 401 that survives the refresh', async () => {
    reply = (_method, path) =>
      path === '/auth/refresh' ? ok({ id: 'u1' }) : unauthenticated

    await expect(http.get('/balances')).rejects.toMatchObject({
      status: 401,
      code: 'auth.unauthenticated',
    })
    expect(countOf('/balances')).toBe(2)
    expect(countOf('/auth/refresh')).toBe(1)
  })

  it('ends the session when the refresh itself is refused', async () => {
    reply = () => unauthenticated

    await expect(http.get('/balances')).rejects.toBeInstanceOf(ApiError)
    expect(endSession).toHaveBeenCalledTimes(1)
  })

  it('keeps a sign-in that lands while a refused refresh is in flight', async () => {
    // The Google callback page: the boot `/auth/me` check runs cookie-less alongside the
    // code exchange, whose response sets the cookies before the refresh's 401 comes back.
    reply = (_method, path) => {
      if (path === '/auth/refresh') {
        useSessionStore.getState().setUser({ id: 'u1' } as User)
      }
      return unauthenticated
    }

    await expect(http.get('/auth/me')).rejects.toMatchObject({ status: 401 })
    expect(endSession).not.toHaveBeenCalled()
    useSessionStore.getState().clear()
  })

  it('never refreshes for the anonymous auth endpoints', async () => {
    reply = () => unauthenticated

    await expect(
      http.post('/auth/login', { email: 'a@b.c', password: 'x' }),
    ).rejects.toMatchObject({ status: 401 })
    await expect(http.post('/auth/refresh')).rejects.toMatchObject({
      status: 401,
    })
    await expect(http.post('/auth/logout')).rejects.toMatchObject({
      status: 401,
    })

    expect(countOf('/auth/login')).toBe(1)
    expect(countOf('/auth/refresh')).toBe(1)
    expect(countOf('/auth/logout')).toBe(1)
    expect(endSession).not.toHaveBeenCalled()
  })

  it('leaves an offline client signed in, with its local data', async () => {
    reply = () => 'network'

    await expect(http.get('/balances')).rejects.toMatchObject({
      code: 'common.network',
      status: 0,
    })
    expect(countOf('/auth/refresh')).toBe(0)
    expect(endSession).not.toHaveBeenCalled()
  })

  it('does not sign out when the network drops between the 401 and the refresh', async () => {
    reply = (_method, path) =>
      path === '/auth/refresh' ? 'network' : unauthenticated

    // The transient failure wins over the 401: the sync engine keeps its outbox on `status: 0`.
    await expect(http.get('/balances')).rejects.toMatchObject({
      code: 'common.network',
      status: 0,
    })
    expect(endSession).not.toHaveBeenCalled()
  })

  it('refreshes an expired session on the /auth/me bootstrap', async () => {
    let refreshed = false
    reply = (_method, path) => {
      if (path === '/auth/refresh') {
        refreshed = true
        return ok({ id: 'u1' })
      }
      return refreshed ? ok({ id: 'u1' }) : unauthenticated
    }

    await expect(http.get('/auth/me')).resolves.toEqual({ id: 'u1' })
    expect(countOf('/auth/refresh')).toBe(1)
  })
})
