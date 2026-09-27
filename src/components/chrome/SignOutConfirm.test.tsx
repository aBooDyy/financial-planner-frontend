// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { SignOutConfirm } from './SignOutConfirm'

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})
afterEach(() => {
  cleanup()
  setOnline(true)
})

const renderConfirm = () => {
  const onSignOut = vi.fn()
  render(
    <SignOutConfirm
      open
      onOpenChange={() => undefined}
      onSignOut={onSignOut}
    />,
  )
  return {
    onSignOut,
    confirm: screen.getByRole('button', { name: 'Sign out' }),
  }
}

describe('SignOutConfirm', () => {
  it('signs out when online', () => {
    setOnline(true)
    const { onSignOut, confirm } = renderConfirm()

    fireEvent.click(confirm)

    expect(onSignOut).toHaveBeenCalledOnce()
    expect(screen.queryByText(/needs a connection/)).toBeNull()
  })

  it('refuses offline and says why', () => {
    setOnline(false)
    const { onSignOut, confirm } = renderConfirm()

    expect(confirm).toHaveProperty('disabled', true)
    fireEvent.click(confirm)

    expect(onSignOut).not.toHaveBeenCalled()
    expect(screen.getByText(/Signing out needs a connection/)).toBeTruthy()
  })
})
