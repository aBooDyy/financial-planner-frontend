// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LocalIntegrationKey } from '#/db/types'
import { aKey } from '#/features/integrations/__fixtures__/keys'
import { KeyRow } from './KeyRow'

afterEach(cleanup)

const inDays = (days: number) =>
  new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()

const renderRow = (
  key: LocalIntegrationKey,
  walletName: string | null = null,
) =>
  render(
    <ul>
      <KeyRow
        apiKey={key}
        walletName={walletName}
        online
        onEdit={vi.fn()}
        onRotate={vi.fn()}
        onRevoke={vi.fn()}
        onDelete={vi.fn()}
      />
    </ul>,
  )

/** Radix opens its menu on pointerdown, not click. */
const openMenu = (name: string) =>
  fireEvent.pointerDown(
    screen.getByRole('button', { name: `More actions for ${name}` }),
    { button: 0, ctrlKey: false, pointerType: 'mouse' },
  )

describe('KeyRow', () => {
  it('shows the name, the prefix — never more — and the rule count', () => {
    renderRow(aKey({ ruleCount: 2 }), 'Visa (main)')
    expect(screen.getByText('Tasker — SMS alerts')).toBeDefined()
    expect(screen.getByText('fpk_7f3a9c21…')).toBeDefined()
    expect(screen.getByText('2 rules')).toBeDefined()
    expect(
      screen.getByText(/Active · Visa \(main\) · not used yet/),
    ).toBeDefined()
  })

  it('warns about a key that expires within two weeks', () => {
    renderRow(aKey({ expiresAt: inDays(12) }))
    expect(screen.getByText(/expires in (11|12) days/)).toBeDefined()
    expect(document.querySelector('.bg-fp-warn')).not.toBeNull()
  })

  it('says when a key was last used', () => {
    renderRow(aKey({ lastUsedAt: inDays(-2) }))
    expect(screen.getByText(/last used 2 days ago/)).toBeDefined()
  })

  it('offers Rotate, not Revoke, on a revoked key', () => {
    renderRow(aKey({ status: 'revoked', requestsCount: 412 }))
    expect(screen.getByText('Revoked · 412 requests')).toBeDefined()
    openMenu('Tasker — SMS alerts')
    expect(
      screen.getByRole('menuitem', { name: 'Rotate secret' }),
    ).toBeDefined()
    expect(screen.queryByRole('menuitem', { name: 'Revoke' })).toBeNull()
  })

  it('offers Revoke on an active key', () => {
    renderRow(aKey())
    openMenu('Tasker — SMS alerts')
    expect(screen.getByRole('menuitem', { name: 'Revoke' })).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeDefined()
  })

  it('says a throttled key is refusing requests, and when that ends', () => {
    const until = new Date(Date.now() + 34_000).toISOString()
    renderRow(aKey({ throttledUntil: until, rateLimitPerMinute: 60 }))
    expect(
      screen.getByText(/Over its limit of 60 a minute — requests are refused/),
    ).toBeDefined()
    expect(screen.getByText(/accepted again in 3\d seconds/)).toBeDefined()
  })

  it('drops the throttle notice once the window has rolled', () => {
    renderRow(aKey({ throttledUntil: inDays(-1) }))
    expect(screen.queryByText(/Over its limit/)).toBeNull()
  })
})
