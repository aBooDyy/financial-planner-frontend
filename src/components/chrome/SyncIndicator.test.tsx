// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '#/components/ui/tooltip'
import { db } from '#/db/db'
import { useSyncActivityStore } from '#/db/syncActivity'
import type { OutboxEntry } from '#/db/types'
import { SyncIndicator } from './SyncIndicator'

const rejectedEntry: OutboxEntry = {
  op: 'create',
  entity: 'transaction',
  id: 't1',
  payload: {},
  baseVersion: null,
  createdAt: '2026-09-28T00:00:00Z',
  failure: {
    kind: 'rejected',
    status: 422,
    code: 'common.validation',
    field: null,
    message: '',
    at: '2026-09-28T00:00:00Z',
  },
}

const renderIndicator = () =>
  render(
    <TooltipProvider>
      <SyncIndicator />
    </TooltipProvider>,
  )

const setRunning = (running: number) =>
  act(() => useSyncActivityStore.setState({ running }))

const trigger = () => screen.getByRole('button', { name: /^Sync:/ })
const isTucked = () => trigger().closest('[inert]') !== null

beforeEach(async () => {
  await db.outbox.clear()
  useSyncActivityStore.setState({
    running: 0,
    lastSyncedAt: null,
    lastPassFailed: false,
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SyncIndicator', () => {
  it('announces syncing while a sync runs, and nothing once it is done', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    renderIndicator()
    expect(screen.getByRole('status').textContent).toBe('')

    setRunning(1)
    act(() => void vi.advanceTimersByTime(300))
    expect(screen.getByRole('status').textContent).toBe('Syncing')
    expect(trigger().getAttribute('aria-label')).toBe('Sync: Syncing')

    act(() => useSyncActivityStore.setState({ lastSyncedAt: Date.now() }))
    setRunning(0)
    act(() => void vi.advanceTimersByTime(700))
    expect(screen.getByRole('status').textContent).toBe('')
    expect(trigger().getAttribute('aria-label')).toBe(
      'Sync: All changes synced',
    )
  })

  it('shows the check once a sync finishes, then tucks itself away', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    renderIndicator()
    expect(isTucked()).toBe(true)

    act(() => useSyncActivityStore.setState({ lastSyncedAt: Date.now() }))
    expect(isTucked()).toBe(false)
    expect(trigger().getAttribute('aria-label')).toBe(
      'Sync: All changes synced',
    )

    act(() => void vi.advanceTimersByTime(2500))
    expect(isTucked()).toBe(true)
  })

  it('explains itself on press', async () => {
    renderIndicator()
    act(() => useSyncActivityStore.setState({ lastSyncedAt: Date.now() }))

    fireEvent.click(trigger())

    expect(await screen.findByText(/backed up to your account/)).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry now' })).toBeNull()
  })

  it('turns to an alert with Retry now when a change was refused', async () => {
    await db.outbox.add(rejectedEntry)
    renderIndicator()

    const button = await screen.findByRole('button', {
      name: 'Sync: 1 change didn’t sync',
    })
    expect(isTucked()).toBe(false)
    fireEvent.click(button)

    expect(
      await screen.findByRole('button', { name: 'Retry now' }),
    ).not.toBeNull()
  })

  it('leaves the offline pill to speak while offline', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })
    try {
      renderIndicator()
      expect(screen.queryByRole('button', { name: /^Sync:/ })).toBeNull()
    } finally {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => true,
      })
    }
  })
})
