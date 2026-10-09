// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '#/features/auth/api/types'

const KEY = 'fp-session-user'

const user: User = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  onboardedAt: '2026-01-01T00:00:00Z',
  hasPassword: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 'v1',
}

/** The store reads the cache once, when it is created — so each case loads a fresh one. */
const freshStore = async () => {
  vi.resetModules()
  return (await import('./session')).useSessionStore
}

beforeEach(() => {
  localStorage.clear()
})

describe('session store and its cached user', () => {
  it('starts loading when this device has no cached user', async () => {
    const store = await freshStore()
    expect(store.getState()).toMatchObject({
      status: 'loading',
      user: null,
      verified: false,
    })
  })

  it('starts signed in, unverified, as the cached user', async () => {
    localStorage.setItem(KEY, JSON.stringify(user))
    const store = await freshStore()
    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      user,
      verified: false,
    })
  })

  it('ignores a cached value that is not a user', async () => {
    localStorage.setItem(KEY, JSON.stringify({ id: 'u1' }))
    expect((await freshStore()).getState().status).toBe('loading')

    localStorage.setItem(KEY, '{not json')
    expect((await freshStore()).getState().status).toBe('loading')
  })

  it('caches the user the server confirmed and marks the session verified', async () => {
    const store = await freshStore()
    store.getState().setUser(user)

    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      verified: true,
    })
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual(user)
  })

  it('forgets the cached user when the session is cleared', async () => {
    const store = await freshStore()
    store.getState().setUser(user)
    store.getState().clear()

    expect(store.getState()).toMatchObject({
      status: 'anonymous',
      user: null,
      verified: false,
    })
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
