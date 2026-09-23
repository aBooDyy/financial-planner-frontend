// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePreferencesStore } from '#/stores/preferences'
import { useSessionStore } from '#/stores/session'
import type { User } from '#/features/auth/api/types'
import { BUNDLED_CONFIG } from './bundledConfig'
import { useAppConfigStore } from './appConfig'
import type { AppConfig } from './appConfig'
import { useAppConfig } from './useAppConfig'

const fetchConfig = vi.fn()
const loadCached = vi.fn()
const saveCached = vi.fn()

vi.mock('./configApi', () => ({
  configApi: { get: () => fetchConfig() },
}))
vi.mock('./configCache', () => ({
  loadCachedConfig: () => loadCached(),
  saveCachedConfig: (config: AppConfig) => saveCached(config),
}))

const aConfig = (over: Partial<AppConfig> = {}): AppConfig => ({
  ...BUNDLED_CONFIG,
  version: 'test.1',
  currencies: [{ code: 'ZZZ', name: 'Test Coin', symbol: 'Z', minorUnit: 2 }],
  ...over,
})

const signIn = () =>
  useSessionStore.setState({
    status: 'authenticated',
    user: { id: 'u1' } as User,
  })

beforeEach(() => {
  useAppConfigStore.setState({
    config: BUNDLED_CONFIG,
    ratesVersion: BUNDLED_CONFIG.version,
  })
  usePreferencesStore.setState({ autoUpdateRates: true })
  useSessionStore.setState({ status: 'anonymous', user: null })
  fetchConfig.mockReset().mockResolvedValue(aConfig())
  loadCached.mockReset().mockResolvedValue(null)
  saveCached.mockReset().mockResolvedValue(undefined)
})

describe('useAppConfig', () => {
  it('serves the bundled snapshot before anything is fetched', () => {
    renderHook(() => useAppConfig())
    expect(useAppConfigStore.getState().config.version).toBe(
      BUNDLED_CONFIG.version,
    )
    expect(
      useAppConfigStore.getState().config.currencies.length,
    ).toBeGreaterThan(100)
  })

  it('keeps the cached config when the network is unreachable', async () => {
    loadCached.mockResolvedValue(aConfig({ version: 'cached.1' }))
    fetchConfig.mockRejectedValue(new Error('offline'))
    signIn()

    renderHook(() => useAppConfig())

    await waitFor(() =>
      expect(useAppConfigStore.getState().config.version).toBe('cached.1'),
    )
    // A failed refresh is silent: the cached values stand and nothing is re-cached.
    expect(saveCached).not.toHaveBeenCalled()
  })

  it('falls back to the bundle when there is no cache and no network', async () => {
    fetchConfig.mockRejectedValue(new Error('offline'))
    signIn()

    renderHook(() => useAppConfig())

    await waitFor(() => expect(fetchConfig).toHaveBeenCalled())
    expect(useAppConfigStore.getState().config).toBe(BUNDLED_CONFIG)
  })

  it('applies and caches a fresh config once a session exists', async () => {
    signIn()
    renderHook(() => useAppConfig())

    await waitFor(() =>
      expect(useAppConfigStore.getState().config.version).toBe('test.1'),
    )
    expect(saveCached).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'test.1' }),
    )
  })

  it('does not fetch without a session', () => {
    renderHook(() => useAppConfig())
    expect(fetchConfig).not.toHaveBeenCalled()
  })

  it('pins the rates but still refreshes the table when auto-update is off', async () => {
    usePreferencesStore.setState({ autoUpdateRates: false })
    fetchConfig.mockResolvedValue(aConfig({ rates: { SAR: 1, USD: 9 } }))
    signIn()

    renderHook(() => useAppConfig())

    await waitFor(() =>
      expect(useAppConfigStore.getState().config.version).toBe('test.1'),
    )
    const state = useAppConfigStore.getState()
    // The currency table moved; the rate the user converts at did not.
    expect(state.config.currencies).toHaveLength(1)
    expect(state.config.rates.USD).toBe(BUNDLED_CONFIG.rates.USD)
    // …and the store remembers how far behind those rates now are.
    expect(state.ratesVersion).toBe(BUNDLED_CONFIG.version)
  })

  it('adopts the pinned rates once auto-update is turned back on', async () => {
    usePreferencesStore.setState({ autoUpdateRates: false })
    fetchConfig.mockResolvedValue(aConfig({ rates: { SAR: 1, USD: 9 } }))
    signIn()

    const { rerender } = renderHook(() => useAppConfig())
    await waitFor(() =>
      expect(useAppConfigStore.getState().config.version).toBe('test.1'),
    )

    usePreferencesStore.setState({ autoUpdateRates: true })
    rerender()

    await waitFor(() =>
      expect(useAppConfigStore.getState().config.rates.USD).toBe(9),
    )
    expect(useAppConfigStore.getState().ratesVersion).toBe('test.1')
  })

  it('caches the config that is actually in use, not the one fetched', async () => {
    usePreferencesStore.setState({ autoUpdateRates: false })
    fetchConfig.mockResolvedValue(aConfig({ rates: { SAR: 1, USD: 9 } }))
    signIn()

    renderHook(() => useAppConfig())

    await waitFor(() => expect(saveCached).toHaveBeenCalled())
    // A reload while offline must convert at the rates the user was just converting at.
    expect(saveCached.mock.calls[0][0].rates.USD).toBe(BUNDLED_CONFIG.rates.USD)
  })
})
