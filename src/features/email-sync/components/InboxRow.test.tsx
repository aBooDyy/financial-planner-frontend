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
const beginInboxReconnect = vi.fn()

vi.mock('#/features/email-sync/data/connect', () => ({
  beginInboxReconnect: (...args: unknown[]) => beginInboxReconnect(...args),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

afterEach(cleanup)
beforeEach(() => {
  beginInboxReconnect.mockReset().mockResolvedValue(undefined)
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
    expect(screen.getByText('Sync complete')).toBeTruthy()
  })

  it('shows progress while a sync runs', async () => {
    let finish: (value: unknown) => void = () => {}
    runEmailSync.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    renderRow(inbox())

    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(await screen.findByText('Checking for new emails…')).toBeTruthy()

    finish({
      syncedConnections: 1,
      scannedMessages: 3,
      newImports: 2,
      autoConfirmed: 0,
      ignored: 1,
      failures: [],
      connections: [],
    })
    expect(await screen.findByText('Review 2 now')).toBeTruthy()
  })

  it('says when a sync fails and retries it', async () => {
    runEmailSync.mockRejectedValueOnce({ code: 'network' })
    renderRow(inbox())

    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(await screen.findByText('Sync failed')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(runEmailSync).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Sync complete')).toBeTruthy()
  })

  it('can be dismissed', async () => {
    renderRow(inbox())
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    await screen.findByText('Sync complete')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Sync complete')).toBeNull()
  })

  it('asks for a first rule when the inbox has none', () => {
    const { onAddRule } = renderRow(inbox({ rules: [] }))
    expect(
      screen.getByText('Nothing is read from this inbox until it has a rule.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }))
    expect(onAddRule).toHaveBeenCalled()
  })

  it('asks to sign in again once the provider refused the inbox', async () => {
    renderRow(inbox({ status: 'needs_reauth' }))
    expect(screen.getByText(/Means lost access to this inbox/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    await waitFor(() =>
      expect(beginInboxReconnect).toHaveBeenCalledWith(
        { id: 'c1', provider: 'google' },
        '/',
      ),
    )
  })

  it('says why a reconnect could not start and lets it be tried again', async () => {
    beginInboxReconnect.mockRejectedValueOnce({
      code: 'email_sync.provider.not_configured',
    })
    renderRow(inbox({ status: 'needs_reauth' }))

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    expect(
      await screen.findByText(
        'That inbox needs reconnecting before it can be scanned.',
      ),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Reconnect' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  it('cannot sync offline', () => {
    renderRow(inbox(), false)
    expect(
      screen.getByRole('button', { name: 'Sync now' }).hasAttribute('disabled'),
    ).toBe(true)
  })
})
