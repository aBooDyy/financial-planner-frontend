// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalEmailConnection } from '#/db/types'
import { InboxRow } from './InboxRow'

const runEmailSync = vi.fn()

vi.mock('#/features/email-sync/data/mutations', () => ({
  runEmailSync: (...args: unknown[]) => runEmailSync(...args),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

afterEach(cleanup)
beforeEach(() => {
  runEmailSync.mockReset().mockResolvedValue({
    syncedConnections: 1,
    scannedMessages: 0,
    newImports: 0,
    autoConfirmed: 0,
    ignored: 0,
    failures: [],
    connections: [],
  })
})

const inbox = (
  over: Partial<LocalEmailConnection> = {},
): LocalEmailConnection => ({
  id: 'c1',
  provider: 'google',
  email: 'khalid@example.com',
  autoSync: true,
  scanFrequency: 'hourly',
  status: 'connected',
  lastSyncedAt: null,
  rules: [
    {
      id: 'r1',
      name: 'Card',
      enabled: true,
      senders: ['alerts@bank.com'],
      walletId: null,
      type: 'spend',
      autoConfirm: false,
    },
  ],
  createdAt: '',
  updatedAt: '',
  version: 'v',
  ...over,
})

const renderRow = (connection: LocalEmailConnection, online = true) => {
  const handlers = {
    onEdit: vi.fn(),
    onAddRule: vi.fn(),
    onDisconnect: vi.fn(),
  }
  render(
    <ul>
      <InboxRow connection={connection} online={online} {...handlers} />
    </ul>,
  )
  return handlers
}

describe('InboxRow', () => {
  it('says what the inbox is and syncs it from the last sync', async () => {
    renderRow(inbox())
    expect(screen.getByText('Gmail · 1 rule · Never synced')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    await waitFor(() =>
      expect(runEmailSync).toHaveBeenCalledWith({
        limit: 100,
        connectionId: 'c1',
      }),
    )
    expect(
      await screen.findByText('No new emails to scan — you’re up to date.'),
    ).toBeTruthy()
  })

  it('asks for a first rule when the inbox has none', () => {
    const { onAddRule } = renderRow(inbox({ rules: [] }))
    expect(
      screen.getByText('Nothing is read from this inbox until it has a rule.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }))
    expect(onAddRule).toHaveBeenCalled()
  })

  it('cannot sync offline', () => {
    renderRow(inbox(), false)
    expect(
      screen.getByRole('button', { name: 'Sync now' }).hasAttribute('disabled'),
    ).toBe(true)
  })
})
