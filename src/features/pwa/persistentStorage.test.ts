// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type StorageStub = {
  persisted?: () => Promise<boolean>
  persist?: () => Promise<boolean>
}

const stubStorage = (storage: StorageStub | undefined) =>
  Object.defineProperty(navigator, 'storage', {
    value: storage,
    configurable: true,
  })

const load = async () =>
  (await import('./persistentStorage')).requestPersistentStorage

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  stubStorage(undefined)
})

describe('requestPersistentStorage', () => {
  it('asks once per page load', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => false, persist })
    const request = await load()

    expect(await request()).toBe(true)
    expect(await request()).toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => true, persist })

    expect(await (await load())()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('reports a refusal, an error or a missing API as not persisted', async () => {
    stubStorage({ persisted: async () => false, persist: async () => false })
    expect(await (await load())()).toBe(false)

    vi.resetModules()
    stubStorage({
      persist: () => Promise.reject(new Error('SecurityError')),
    })
    expect(await (await load())()).toBe(false)

    vi.resetModules()
    stubStorage(undefined)
    expect(await (await load())()).toBe(false)
  })
})
