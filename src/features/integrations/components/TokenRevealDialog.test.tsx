// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { REVEAL_UNLOCK_MS, TokenRevealDialog } from './TokenRevealDialog'

const TOKEN = 'fpk_7f3a9c21.xZ3kQpV9mB2tLr8NwYc4HsJdF6aEgU1oPiRvTnMkZbA'

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
  vi.useRealTimers()
})

const continueButton = () =>
  screen.getByRole('button', { name: 'I’ve copied it' })

const renderReveal = (onContinue = vi.fn()) =>
  render(
    <TokenRevealDialog
      token={TOKEN}
      title="Key created"
      continueLabel="I’ve copied it"
      onContinue={onContinue}
    />,
  )

describe('TokenRevealDialog', () => {
  it('shows the secret read-only and offers no way to close', () => {
    renderReveal()
    const field = screen.getByLabelText('Integration key')
    expect(field).toHaveProperty('value', TOKEN)
    expect(field).toHaveProperty('readOnly', true)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('keeps Continue disabled until the key is copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    renderReveal()
    expect(continueButton()).toHaveProperty('disabled', true)

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Copy integration key' }),
      )
    })

    expect(writeText).toHaveBeenCalledWith(TOKEN)
    expect(continueButton()).toHaveProperty('disabled', false)
    expect(screen.getByText('Copied')).toBeDefined()
  })

  it('unlocks Continue on its own after a few seconds', () => {
    vi.useFakeTimers()
    renderReveal()
    expect(continueButton()).toHaveProperty('disabled', true)
    act(() => {
      vi.advanceTimersByTime(REVEAL_UNLOCK_MS)
    })
    expect(continueButton()).toHaveProperty('disabled', false)
  })

  it('does not close on Escape', () => {
    renderReveal()
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    })
    expect(screen.getByLabelText('Integration key')).toBeDefined()
  })

  it('leaves no trace of the token once it is gone', () => {
    const { rerender, unmount } = renderReveal()
    rerender(
      <TokenRevealDialog
        token={null}
        title="Key created"
        continueLabel="I’ve copied it"
        onContinue={vi.fn()}
      />,
    )
    expect(document.body.innerHTML).not.toContain(TOKEN)
    unmount()
    expect(document.body.innerHTML).not.toContain(TOKEN)
  })
})
