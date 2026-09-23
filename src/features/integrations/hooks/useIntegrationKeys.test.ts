// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalDb, db } from '#/db/db'
import { aKey } from '#/features/integrations/__fixtures__/keys'
import type { IntegrationKey } from '#/features/integrations/api/types'
import { ApiError } from '#/lib/apiError'
import { pullIntegrationKeys } from '#/features/integrations/data/cache'
import { useIntegrationKeys } from './useIntegrationKeys'

const api = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  rotate: vi.fn(),
  remove: vi.fn(),
}

vi.mock('#/features/integrations/api/integrationKeysApi', () => ({
  integrationKeysApi: {
    list: () => api.list(),
    create: (...a: unknown[]) => api.create(...a),
    update: (...a: unknown[]) => api.update(...a),
    rotate: (...a: unknown[]) => api.rotate(...a),
    remove: (...a: unknown[]) => api.remove(...a),
  },
}))

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })

const serverKey = (over: Partial<IntegrationKey> = {}): IntegrationKey =>
  aKey(over)

beforeEach(async () => {
  Object.values(api).forEach((fn) => fn.mockReset())
  setOnline(true)
  await db.integrationKeys.clear()
})

afterEach(() => setOnline(true))

describe('useIntegrationKeys', () => {
  it('renders the cached keys first, then the server’s', async () => {
    await db.integrationKeys.put(aKey({ id: 'cached', name: 'Cached' }))
    let answer!: (keys: IntegrationKey[]) => void
    api.list.mockReturnValue(new Promise((res) => (answer = res)))

    const { result } = renderHook(() => useIntegrationKeys())
    await waitFor(() =>
      expect(result.current.keys.map((k) => k.name)).toEqual(['Cached']),
    )

    await act(async () => answer([serverKey({ id: 'fresh', name: 'Fresh' })]))
    await waitFor(() =>
      expect(result.current.keys.map((k) => k.name)).toEqual(['Fresh']),
    )
    expect(result.current.stale).toBe(false)
  })

  it('drops a list that was in flight when sign-out wiped the cache', async () => {
    let answer!: (keys: IntegrationKey[]) => void
    api.list.mockReturnValue(new Promise((res) => (answer = res)))

    const pull = pullIntegrationKeys()
    await clearLocalDb()
    answer([serverKey({ id: 'previous-user' })])
    await pull

    expect(await db.integrationKeys.count()).toBe(0)
  })

  it('renders from Dexie offline and does not ask the server', async () => {
    setOnline(false)
    await db.integrationKeys.put(aKey({ name: 'Tasker' }))

    const { result } = renderHook(() => useIntegrationKeys())
    await waitFor(() => expect(result.current.keys).toHaveLength(1))

    expect(api.list).not.toHaveBeenCalled()
    expect(result.current.online).toBe(false)
    expect(result.current.stale).toBe(true)
  })

  it('keeps the cache and says so when the refresh fails', async () => {
    await db.integrationKeys.put(aKey({ name: 'Tasker' }))
    api.list.mockRejectedValue(
      new ApiError({ code: 'common.network', message: '', status: 0 }),
    )

    const { result } = renderHook(() => useIntegrationKeys())
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.keys.map((k) => k.name)).toEqual(['Tasker'])
  })

  it('surfaces a 409 name_taken as an error on the name field, not a conflict', async () => {
    api.list.mockResolvedValue([])
    api.create.mockRejectedValue(
      new ApiError({
        code: 'integrations.key.name_taken',
        message: 'taken',
        status: 409,
      }),
    )

    const { result } = renderHook(() => useIntegrationKeys())
    let outcome!: Awaited<ReturnType<typeof result.current.create>>
    await act(async () => {
      outcome = await result.current.create({
        name: 'Tasker',
        expiresAt: null,
        defaultWalletId: null,
      })
    })

    expect(outcome).toEqual({
      ok: false,
      failure: {
        fields: { name: 'You already have a key with that name.' },
        general: null,
      },
    })
    expect(await db.integrationKeys.count()).toBe(0)
  })

  it('caches a created key but never its token', async () => {
    api.list.mockResolvedValue([])
    api.create.mockResolvedValue({
      key: serverKey({ id: 'new' }),
      token: 'fpk_7f3a9c21.s3cr3t',
    })

    const { result } = renderHook(() => useIntegrationKeys())
    await act(async () => {
      await result.current.create({
        name: 'Tasker',
        expiresAt: null,
        defaultWalletId: null,
      })
    })

    const cached = await db.integrationKeys.get('new')
    expect(cached).toBeDefined()
    expect(JSON.stringify(cached)).not.toContain('s3cr3t')
  })

  it('revokes through a version-checked update and drops a deleted key', async () => {
    const key = serverKey()
    await db.integrationKeys.put(key)
    api.list.mockResolvedValue([key])
    api.update.mockResolvedValue({ ...key, status: 'revoked', version: 'v2' })
    api.remove.mockResolvedValue(undefined)

    const { result } = renderHook(() => useIntegrationKeys())
    await act(async () => {
      await result.current.revoke(key)
    })
    expect(api.update).toHaveBeenCalledWith(
      'k1',
      'v1',
      expect.objectContaining({ status: 'revoked' }),
    )
    expect((await db.integrationKeys.get('k1'))?.status).toBe('revoked')

    await act(async () => {
      await result.current.remove('k1')
    })
    expect(await db.integrationKeys.get('k1')).toBeUndefined()
  })
})
