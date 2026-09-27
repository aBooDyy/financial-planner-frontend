// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MIN_CHECK_GAP_MS,
  UPDATE_CHECK_INTERVAL_MS,
  watchForUpdates,
} from './watchForUpdates'

const makeRegistration = (installing: ServiceWorker | null = null) =>
  ({
    installing,
    update: vi.fn(() => Promise.resolve()),
  }) as unknown as ServiceWorkerRegistration & {
    update: ReturnType<typeof vi.fn>
  }

const setVisibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
}

let stop: () => void = () => {}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('watchForUpdates', () => {
  it('checks every interval', () => {
    const registration = makeRegistration()
    stop = watchForUpdates(registration)

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('checks when the app returns to the foreground, at most once per gap', () => {
    const registration = makeRegistration()
    stop = watchForUpdates(registration)

    setVisibility('visible')
    expect(registration.update).not.toHaveBeenCalled()

    vi.advanceTimersByTime(MIN_CHECK_GAP_MS)
    setVisibility('hidden')
    expect(registration.update).not.toHaveBeenCalled()
    setVisibility('visible')
    expect(registration.update).toHaveBeenCalledOnce()

    setVisibility('visible')
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('checks when the network comes back', () => {
    const registration = makeRegistration()
    stop = watchForUpdates(registration)

    vi.advanceTimersByTime(MIN_CHECK_GAP_MS)
    window.dispatchEvent(new Event('online'))
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('skips while offline or while a worker is already installing', () => {
    const offline = makeRegistration()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    stop = watchForUpdates(offline)
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)
    expect(offline.update).not.toHaveBeenCalled()
    stop()
    vi.restoreAllMocks()

    const busy = makeRegistration({} as ServiceWorker)
    stop = watchForUpdates(busy)
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)
    expect(busy.update).not.toHaveBeenCalled()
  })

  it('swallows a failed check', async () => {
    const registration = makeRegistration()
    registration.update.mockRejectedValue(new Error('offline'))
    stop = watchForUpdates(registration)

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)
    await vi.runAllTicks()
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('stops every trigger', () => {
    const registration = makeRegistration()
    watchForUpdates(registration)()

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)
    setVisibility('visible')
    window.dispatchEvent(new Event('online'))
    expect(registration.update).not.toHaveBeenCalled()
  })
})
