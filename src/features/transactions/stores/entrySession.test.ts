// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_IDLE_MS, useEntrySession } from './entrySession'

const store = () => useEntrySession.getState()

afterEach(() => {
  vi.useRealTimers()
  useEntrySession.setState({
    walletId: null,
    toWalletId: null,
    date: null,
    scope: null,
  })
})

const hide = (state: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useEntrySession', () => {
  it('remembers a picked day but lets today follow the calendar', () => {
    store().rememberEntry({
      walletId: 'w1',
      date: '2026-09-20',
      today: '2026-09-28',
    })
    expect(store().date).toBe('2026-09-20')
    store().rememberEntry({
      walletId: 'w1',
      date: '2026-09-28',
      today: '2026-09-28',
    })
    expect(store().date).toBeNull()
  })

  it('keeps the transfer destination across a spend', () => {
    store().rememberEntry({
      walletId: 'w1',
      toWalletId: 'w2',
      date: '2026-09-28',
      today: '2026-09-28',
    })
    store().rememberEntry({
      walletId: 'w3',
      date: '2026-09-28',
      today: '2026-09-28',
    })
    expect(store().walletId).toBe('w3')
    expect(store().toWalletId).toBe('w2')
  })

  it('persists to sessionStorage', () => {
    store().rememberScope({ type: 'wallet', id: 'w1' })
    expect(sessionStorage.getItem('fp-entry-session')).toContain('w1')
  })

  it('forgets after a long time away, not a short one', () => {
    vi.useFakeTimers()
    store().rememberScope({ type: 'wallet', id: 'w1' })
    hide('hidden')
    vi.advanceTimersByTime(SESSION_IDLE_MS / 2)
    hide('visible')
    expect(store().scope).not.toBeNull()

    hide('hidden')
    vi.advanceTimersByTime(SESSION_IDLE_MS + 1)
    hide('visible')
    expect(store().scope).toBeNull()
  })
})
