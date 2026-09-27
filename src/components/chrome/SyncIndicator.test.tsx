// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncActivityStore } from '#/db/syncActivity'
import { SyncIndicator } from './SyncIndicator'

beforeEach(() => {
  vi.useFakeTimers()
  useSyncActivityStore.setState({ running: 0 })
})
afterEach(() => vi.useRealTimers())

const setRunning = (running: number) =>
  act(() => useSyncActivityStore.setState({ running }))

describe('SyncIndicator', () => {
  it('announces syncing while a sync runs, and nothing once it is done', () => {
    render(<SyncIndicator />)
    expect(screen.getByRole('status').textContent).toBe('')

    setRunning(1)
    act(() => void vi.advanceTimersByTime(300))
    expect(screen.getByRole('status').textContent).toBe('Syncing')

    setRunning(0)
    act(() => void vi.advanceTimersByTime(700))
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
