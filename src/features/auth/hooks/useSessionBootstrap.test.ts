// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { notePlannerInputsPulled } from '#/db/pullState'
import type { User } from '#/features/auth/api/types'
import { ApiError } from '#/lib/apiError'
import { useSessionStore } from '#/stores/session'
import { useSessionBootstrap } from './useSessionBootstrap'

/**
 * An installed app opened without a network must come up signed in from the device's cached
 * user; only the server refusing the session may sign it out.
 */

const me = vi.fn<() => Promise<User>>()
vi.mock('#/features/auth/api/authApi', () => ({ authApi: { me: () => me() } }))

const KEY = 'fp-session-user'

const aUser = (over: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  onboardedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 'v1',
  ...over,
})

const failure = (status: number) =>
  new ApiError({
    code: status === 0 ? 'common.network' : 'common.unexpected',
    message: '',
    status,
  })

/** What the store looks like on a launch where this device had cached `user`. */
const launchWithCache = (user: User) => {
  localStorage.setItem(KEY, JSON.stringify(user))
  useSessionStore.setState({ status: 'authenticated', user, verified: false })
}

const cachedUser = (): unknown =>
  JSON.parse(localStorage.getItem(KEY) ?? 'null')
const localRows = () => db.syncState.count()

/** Lets a verification that changes nothing run to its end before asserting that. */
const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 30)))

const boot = async () => {
  const hook = renderHook(() => useSessionBootstrap())
  await waitFor(() => expect(me).toHaveBeenCalled())
  await settle()
  return hook
}

afterEach(cleanup)

beforeEach(async () => {
  me.mockReset()
  localStorage.clear()
  useSessionStore.setState({ status: 'loading', user: null, verified: false })
  await db.syncState.clear()
  await db.syncState.put({ id: 'u1:transaction', since: 'x', updatedAt: 'x' })
})

describe('useSessionBootstrap', () => {
  it('signs in and caches the user the server confirms', async () => {
    me.mockResolvedValue(aUser())

    await boot()

    expect(useSessionStore.getState()).toMatchObject({
      status: 'authenticated',
      verified: true,
      user: aUser(),
    })
    expect(cachedUser()).toEqual(aUser())
  })

  it('replaces a cached profile with the server’s, keeping the local data', async () => {
    launchWithCache(aUser({ name: 'Old' }))
    me.mockResolvedValue(aUser({ name: 'New' }))

    await boot()

    expect(useSessionStore.getState().user?.name).toBe('New')
    expect(cachedUser()).toMatchObject({ name: 'New' })
    expect(await localRows()).toBe(1)
  })

  it.each([401, 403])(
    'signs out, forgets the cached user and wipes local data on a %i',
    async (status) => {
      launchWithCache(aUser())
      me.mockRejectedValue(failure(status))

      renderHook(() => useSessionBootstrap())

      await waitFor(() =>
        expect(useSessionStore.getState().status).toBe('anonymous'),
      )
      expect(cachedUser()).toBeNull()
      await waitFor(async () => expect(await localRows()).toBe(0))
    },
  )

  it.each([0, 408, 429, 500, 503])(
    'stays signed in as the cached user when the server cannot answer (%i)',
    async (status) => {
      launchWithCache(aUser())
      me.mockRejectedValue(failure(status))

      await boot()

      expect(useSessionStore.getState()).toMatchObject({
        status: 'authenticated',
        verified: false,
        user: aUser(),
      })
      expect(cachedUser()).toEqual(aUser())
      expect(await localRows()).toBe(1)
    },
  )

  it('stays anonymous when the server cannot answer and nothing is cached', async () => {
    me.mockRejectedValue(failure(0))

    await boot()

    expect(useSessionStore.getState().status).toBe('anonymous')
    expect(await localRows()).toBe(1)
  })

  it('signs out through the wipe when a check after reconnecting is refused', async () => {
    launchWithCache(aUser())
    me.mockRejectedValue(failure(0))
    await boot()

    me.mockRejectedValue(failure(401))
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() =>
      expect(useSessionStore.getState().status).toBe('anonymous'),
    )
    expect(cachedUser()).toBeNull()
    await waitFor(async () => expect(await localRows()).toBe(0))
  })

  it('confirms a cached session once the browser is back online', async () => {
    launchWithCache(aUser())
    me.mockRejectedValue(failure(0))
    await boot()

    me.mockResolvedValue(aUser())
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => expect(useSessionStore.getState().verified).toBe(true))
  })

  it('confirms a cached session after a successful sync pull', async () => {
    launchWithCache(aUser())
    me.mockRejectedValue(failure(503))
    await boot()

    me.mockResolvedValue(aUser())
    act(() => notePlannerInputsPulled())

    await waitFor(() => expect(useSessionStore.getState().verified).toBe(true))
  })

  it('does not re-ask about a session the server already confirmed', async () => {
    me.mockResolvedValue(aUser())
    await boot()

    act(() => {
      window.dispatchEvent(new Event('online'))
      notePlannerInputsPulled()
    })
    await settle()

    expect(me).toHaveBeenCalledTimes(1)
  })

  it('wipes the cached user’s data when the cookie belongs to someone else', async () => {
    launchWithCache(aUser())
    me.mockResolvedValue(aUser({ id: 'u2' }))

    await boot()

    expect(useSessionStore.getState().user?.id).toBe('u2')
    expect(cachedUser()).toMatchObject({ id: 'u2' })
    expect(await localRows()).toBe(0)
  })

  it('drops an answer that arrives after the session ended', async () => {
    launchWithCache(aUser())
    let answer: (user: User) => void = () => undefined
    me.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    renderHook(() => useSessionBootstrap())
    await waitFor(() => expect(me).toHaveBeenCalled())

    act(() => useSessionStore.getState().clear())
    answer(aUser())
    await settle()

    expect(useSessionStore.getState().status).toBe('anonymous')
    expect(cachedUser()).toBeNull()
  })

  it('stops watching for reconnects once unmounted', async () => {
    launchWithCache(aUser())
    me.mockRejectedValue(failure(0))
    const { unmount } = await boot()

    unmount()
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await settle()

    expect(me).toHaveBeenCalledTimes(1)
  })
})
