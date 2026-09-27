// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthScreen } from './AuthScreen'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}))

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(() => {
  cleanup()
  setOnline(true)
})

const button = (name: string) => screen.getByRole('button', { name })

describe('AuthScreen offline', () => {
  it('lets you sign in while online', () => {
    setOnline(true)
    render(<AuthScreen mode="login" />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(button('Log in')).toHaveProperty('disabled', false)
    expect(button('Continue with Google')).toHaveProperty('disabled', false)
  })

  it('says signing in needs a connection, and holds both ways in', () => {
    setOnline(false)
    render(<AuthScreen mode="login" />)

    expect(screen.getByRole('status').textContent).toMatch(
      /Signing in needs a connection/,
    )
    expect(button('Log in')).toHaveProperty('disabled', true)
    expect(button('Continue with Google')).toHaveProperty('disabled', true)
  })

  it('says the same of creating an account', () => {
    setOnline(false)
    render(<AuthScreen mode="signup" />)

    expect(screen.getByRole('status').textContent).toMatch(
      /Creating an account needs a connection/,
    )
    expect(button('Create account')).toHaveProperty('disabled', true)
  })
})
