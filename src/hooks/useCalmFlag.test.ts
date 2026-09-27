// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCalmFlag } from './useCalmFlag'

const render = () =>
  renderHook(({ value }) => useCalmFlag(value, 300, 700), {
    initialProps: { value: false },
  })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useCalmFlag', () => {
  it('never shows a blip shorter than the show delay', () => {
    const { result, rerender } = render()

    rerender({ value: true })
    act(() => void vi.advanceTimersByTime(200))
    rerender({ value: false })
    act(() => void vi.advanceTimersByTime(1000))

    expect(result.current).toBe(false)
  })

  it('shows once the value has held for the delay', () => {
    const { result, rerender } = render()

    rerender({ value: true })
    act(() => void vi.advanceTimersByTime(299))
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(1))

    expect(result.current).toBe(true)
  })

  it('stays on for the minimum time after the value drops', () => {
    const { result, rerender } = render()
    rerender({ value: true })
    act(() => void vi.advanceTimersByTime(300))

    rerender({ value: false })
    act(() => void vi.advanceTimersByTime(600))
    expect(result.current).toBe(true)
    act(() => void vi.advanceTimersByTime(100))

    expect(result.current).toBe(false)
  })

  it('hides at once when it has already been on long enough', () => {
    const { result, rerender } = render()
    rerender({ value: true })
    act(() => void vi.advanceTimersByTime(2000))

    rerender({ value: false })
    act(() => void vi.advanceTimersByTime(0))

    expect(result.current).toBe(false)
  })
})
