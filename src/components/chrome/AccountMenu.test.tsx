// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '#/features/auth/api/types'
import { AccountMenu } from './AccountMenu'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })

const USER = { name: 'Sam Lee', email: 'sam@example.com' } as User

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
  // jsdom has no PointerEvent; Radix opens its menu on a primary-button pointerdown.
  window.PointerEvent = MouseEvent as unknown as typeof PointerEvent
})
afterEach(() => {
  cleanup()
  setOnline(true)
})

const openMenu = () => {
  render(<AccountMenu user={USER} initials="SL" onSignOut={vi.fn()} />)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'SL' }), {
    button: 0,
    ctrlKey: false,
  })
  return screen.getByRole('menuitem', { name: /Sign out/ })
}

describe('AccountMenu sign out', () => {
  it('is offered while online', () => {
    setOnline(true)
    const item = openMenu()
    expect(item.hasAttribute('data-disabled')).toBe(false)
    expect(screen.queryByText(/back online/)).toBeNull()
  })

  it('is held offline, saying when it returns', () => {
    setOnline(false)
    const item = openMenu()
    expect(item.hasAttribute('data-disabled')).toBe(true)
    expect(item.textContent).toMatch(/Available when you’re back online/)
  })
})
