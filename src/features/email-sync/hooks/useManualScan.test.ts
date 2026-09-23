// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/apiError'
import type { SyncResult } from '#/features/email-sync/api/types'
import {
  IN_PROGRESS_CODE,
  MANUAL_SCAN_LIMIT,
  useManualScan,
} from './useManualScan'

const runEmailSync = vi.fn()

vi.mock('#/features/email-sync/data/mutations', () => ({
  runEmailSync: (...args: unknown[]) => runEmailSync(...args),
}))

const aResult = (over: Partial<SyncResult> = {}): SyncResult => ({
  syncedConnections: 1,
  scannedMessages: 128,
  newImports: 6,
  autoConfirmed: 2,
  failures: [],
  ...over,
})

/** A promise plus the handles to settle it, so a scan can be held mid-flight. */
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  runEmailSync.mockReset().mockResolvedValue(aResult())
})

describe('useManualScan', () => {
  it('starts idle and reports counts once a scan lands', async () => {
    const { result } = renderHook(() => useManualScan())
    expect(result.current.state.status).toBe('idle')
    expect(result.current.summary).toBeNull()

    await act(async () => {
      await result.current.scan({ lookbackDays: 30 })
    })

    expect(result.current.state.status).toBe('done')
    expect(result.current.summary?.line).toBe(
      'Scanned 128 emails · 6 new · 2 logged automatically · 4 need review',
    )
    expect(result.current.summary?.reviewCount).toBe(4)
    expect(result.current.summary?.note).toBeNull()
  })

  it('always sends a limit so the backend never reads it as the automatic scan', async () => {
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan()
    })

    expect(runEmailSync).toHaveBeenCalledWith({ limit: MANUAL_SCAN_LIMIT })
  })

  it('passes the caller’s window and connection through', async () => {
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan({ connectionId: 'c1', lookbackDays: 90 })
    })

    expect(runEmailSync).toHaveBeenCalledWith({
      limit: MANUAL_SCAN_LIMIT,
      connectionId: 'c1',
      lookbackDays: 90,
    })
  })

  it('single-flights: a second scan while one is in the air is dropped', async () => {
    const first = deferred<SyncResult>()
    runEmailSync.mockReturnValueOnce(first.promise)
    const { result } = renderHook(() => useManualScan())

    act(() => {
      void result.current.scan({ lookbackDays: 7 })
    })
    await waitFor(() => expect(result.current.state.status).toBe('scanning'))

    act(() => {
      void result.current.scan({ lookbackDays: 180 })
    })
    expect(runEmailSync).toHaveBeenCalledTimes(1)

    await act(async () => {
      first.resolve(aResult())
      await first.promise
    })
    expect(result.current.state.status).toBe('done')
  })

  it('accepts a new scan once the previous one finished', async () => {
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan()
    })
    await act(async () => {
      await result.current.scan()
    })

    expect(runEmailSync).toHaveBeenCalledTimes(2)
  })

  it('releases the single-flight guard after a failure', async () => {
    runEmailSync.mockRejectedValueOnce(
      new ApiError({
        code: 'email_sync.sync.window_invalid',
        message: 'ignored',
        status: 422,
      }),
    )
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan({ lookbackDays: 0 })
    })

    expect(result.current.state).toMatchObject({
      status: 'failed',
      code: 'email_sync.sync.window_invalid',
      message: 'Pick a scan window between 1 and 180 days.',
    })
    expect(result.current.summary).toBeNull()

    await act(async () => {
      await result.current.scan({ lookbackDays: 30 })
    })
    expect(runEmailSync).toHaveBeenCalledTimes(2)
    expect(result.current.state.status).toBe('done')
  })

  it('falls back to a generic message for an unknown error', async () => {
    runEmailSync.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan()
    })

    expect(result.current.state).toMatchObject({
      status: 'failed',
      code: '',
      message: 'Something went wrong. Please try again.',
    })
  })

  it('reports a partial failure with the counts that did land', async () => {
    runEmailSync.mockResolvedValueOnce(
      aResult({
        syncedConnections: 1,
        newImports: 3,
        autoConfirmed: 0,
        failures: [
          { connectionId: 'c2', code: 'email_sync.provider.fetch_failed' },
        ],
      }),
    )
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan()
    })

    expect(result.current.summary?.line).toBe(
      'Scanned 128 emails · 3 new · 3 need review',
    )
    expect(result.current.summary?.note).toBe(
      'Couldn’t reach your inbox provider. Try again.',
    )
  })

  it('counts several unreachable inboxes in one note', async () => {
    runEmailSync.mockResolvedValueOnce(
      aResult({
        failures: [
          { connectionId: 'c2', code: 'email_sync.provider.fetch_failed' },
          { connectionId: 'c3', code: 'email_sync.provider.not_configured' },
        ],
      }),
    )
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan()
    })

    expect(result.current.summary?.note).toBe(
      '2 inboxes couldn’t be read, so their emails weren’t scanned.',
    )
  })

  it('says so plainly when every inbox failed', async () => {
    runEmailSync.mockResolvedValueOnce(
      aResult({
        syncedConnections: 0,
        scannedMessages: 0,
        newImports: 0,
        autoConfirmed: 0,
        failures: [
          { connectionId: 'c1', code: 'email_sync.provider.fetch_failed' },
        ],
      }),
    )
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan()
    })

    expect(result.current.summary?.line).toBe('Nothing was scanned.')
    expect(result.current.summary?.note).toBe(
      'Couldn’t reach your inbox provider. Try again.',
    )
  })

  it('is explicit when a scan read emails but found nothing new', async () => {
    runEmailSync.mockResolvedValueOnce(
      aResult({ newImports: 0, autoConfirmed: 0 }),
    )
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan()
    })

    expect(result.current.summary?.line).toBe(
      'Scanned 128 emails · nothing new. Everything from your tracked senders is already in.',
    )
    expect(result.current.summary?.reviewCount).toBe(0)
  })

  it('is explicit when there was nothing to scan at all', async () => {
    runEmailSync.mockResolvedValueOnce(
      aResult({ scannedMessages: 0, newImports: 0, autoConfirmed: 0 }),
    )
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan()
    })

    expect(result.current.summary?.line).toBe(
      'No new emails to scan — you’re up to date.',
    )
  })

  it('waits and retries once when a scan is already running, never failing', async () => {
    vi.useFakeTimers()
    const inProgress = new ApiError({
      code: IN_PROGRESS_CODE,
      message: 'ignored',
      status: 409,
    })
    runEmailSync
      .mockRejectedValueOnce(inProgress)
      .mockResolvedValueOnce(aResult())
    const { result } = renderHook(() => useManualScan())

    let scanning!: Promise<void>
    act(() => {
      scanning = result.current.scan()
    })
    await act(async () => undefined)
    expect(result.current.state).toMatchObject({
      status: 'busy',
      message:
        'A scan of your inbox is already running. This one will pick up where it leaves off.',
    })

    await act(async () => {
      await vi.runAllTimersAsync()
      await scanning
    })

    expect(runEmailSync).toHaveBeenCalledTimes(2)
    expect(result.current.state.status).toBe('done')
    vi.useRealTimers()
  })

  it('stays busy rather than failing when the retry is refused too', async () => {
    vi.useFakeTimers()
    const inProgress = () =>
      new ApiError({ code: IN_PROGRESS_CODE, message: 'ignored', status: 409 })
    runEmailSync
      .mockRejectedValueOnce(inProgress())
      .mockRejectedValueOnce(inProgress())
    const { result } = renderHook(() => useManualScan())

    let scanning!: Promise<void>
    act(() => {
      scanning = result.current.scan()
    })
    await act(async () => {
      await vi.runAllTimersAsync()
      await scanning
    })

    expect(result.current.state.status).toBe('busy')
    vi.useRealTimers()
  })

  it('reset clears the last result', async () => {
    const { result } = renderHook(() => useManualScan())

    await act(async () => {
      await result.current.scan()
    })
    act(() => {
      result.current.reset()
    })

    expect(result.current.state.status).toBe('idle')
    expect(result.current.summary).toBeNull()
  })
})
