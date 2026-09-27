// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportDetail } from '#/features/inbound-imports/api/types'
import { useImportDetail } from './useImportDetail'

const getImport = vi.fn()

vi.mock('#/features/inbound-imports/api/inboundImportsApi', () => ({
  inboundImportsApi: {
    getImport: (...a: unknown[]) => getImport(...a),
    getImportByTransaction: vi.fn(),
  },
}))

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })

const flip = (online: boolean) =>
  act(() => {
    setOnline(online)
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  })

const DETAIL = { bodyLines: ['Paid 12.00'] } as unknown as ImportDetail
const SOURCE = { kind: 'import', id: 'imp-1' } as const

beforeEach(() => {
  getImport.mockReset().mockResolvedValue(DETAIL)
  setOnline(true)
})
afterEach(() => setOnline(true))

describe('useImportDetail', () => {
  it('waits offline with a calm reason, then loads on reconnect', async () => {
    setOnline(false)
    const { result } = renderHook(() => useImportDetail(SOURCE, true))

    expect(getImport).not.toHaveBeenCalled()
    expect(result.current).toEqual({
      detail: null,
      loading: false,
      error: 'The original message loads when you’re back online.',
    })

    flip(true)

    await waitFor(() => expect(result.current.detail).toBe(DETAIL))
    expect(getImport).toHaveBeenCalledOnce()
  })

  it('keeps a loaded body through a dropped connection without reloading it', async () => {
    const { result } = renderHook(() => useImportDetail(SOURCE, true))
    await waitFor(() => expect(result.current.detail).toBe(DETAIL))

    flip(false)
    expect(result.current.detail).toBe(DETAIL)
    flip(true)

    expect(result.current.detail).toBe(DETAIL)
    expect(getImport).toHaveBeenCalledOnce()
  })
})
