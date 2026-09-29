// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import {
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { TooltipProvider } from '#/components/ui/tooltip'
import { db } from '#/db/db'
import type { OutboxEntry, SyncFailure } from '#/db/types'
import type { ActivityListView } from '#/features/transactions/data/selectors'
import { TransactionList } from './TransactionList'

const retrySync = vi.fn(() => Promise.resolve())
vi.mock('#/db/syncRetry', () => ({
  retrySync: (...args: unknown[]) => retrySync(...(args as [])),
}))

vi.setConfig({ testTimeout: 20000 })
configure({ asyncUtilTimeout: 5000 })

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.hasPointerCapture = () => false
})

afterEach(cleanup)

const TS = '2026-09-26T10:00:00.000Z'

const view: ActivityListView = {
  groups: [
    {
      dateLabel: 'Today',
      totalStr: '−SAR 20',
      rows: [
        {
          kind: 'tx',
          id: 'tx-flagged',
          categoryId: 'cat-dining',
          name: 'Lunch',
          catPath: ['Dining'],
          color: '#e8833a',
          walletPath: ['Cash'],
          walletColor: '#1f9d6b',
          isIncome: false,
          tag: null,
          amountStr: '−SAR 12',
        },
        {
          kind: 'tx',
          id: 'tx-clean',
          categoryId: 'cat-dining',
          name: 'Coffee',
          catPath: ['Dining'],
          color: '#e8833a',
          walletPath: ['Cash'],
          walletColor: '#1f9d6b',
          isIncome: false,
          tag: null,
          amountStr: '−SAR 8',
        },
        {
          kind: 'transfer',
          id: 'transfer-1',
          name: 'To savings',
          fromName: 'Cash',
          fromColor: '#1f9d6b',
          toName: 'Savings',
          toColor: '#2457b8',
          direction: 'neutral',
          amountStr: 'SAR 50',
        },
      ],
    },
  ],
  empty: false,
  emptyTitle: '',
  emptyText: '',
  countStr: '3 transactions',
}

const flagged = (
  entity: OutboxEntry['entity'],
  id: string,
  failure: SyncFailure,
): OutboxEntry => ({
  op: 'create',
  entity,
  id,
  payload: { id },
  baseVersion: null,
  createdAt: TS,
  failure,
  attempts: 1,
  nextAttemptAt: TS,
})

beforeEach(async () => {
  retrySync.mockClear()
  await db.outbox.clear()
  await db.outbox.bulkAdd([
    flagged('transaction', 'tx-flagged', {
      kind: 'rejected',
      status: 422,
      code: 'spending.transaction.wallet_invalid',
      field: 'wallet_id',
      message: 'Wallet not found.',
      at: TS,
    }),
    flagged('transfer', 'transfer-1', {
      kind: 'unavailable',
      status: 503,
      code: 'common.unavailable',
      field: null,
      message: 'Down',
      at: TS,
    }),
  ])
})

const renderList = () => {
  const onRowClick = vi.fn()
  render(
    <TooltipProvider>
      <TransactionList view={view} onAdd={() => {}} onRowClick={onRowClick} />
    </TooltipProvider>,
  )
  return onRowClick
}

describe('the sync badge on a ledger row', () => {
  it('marks only the rows whose changes did not sync', async () => {
    renderList()
    expect(
      await screen.findByRole('button', {
        name: 'Not synced: Wallet no longer available',
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Not synced: Not synced yet' }),
    ).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Not synced/ })).toHaveLength(
      2,
    )
  })

  it('explains itself on hover or focus, naming the wallet', async () => {
    renderList()
    const badge = await screen.findByRole('button', {
      name: 'Not synced: Wallet no longer available',
    })
    fireEvent.focus(badge)
    expect(
      (await screen.findAllByText(/The wallet “Cash” is no longer available/))
        .length,
    ).toBeGreaterThan(0)
  })

  it('opens Retry now and Edit on a press, without opening the row', async () => {
    const onRowClick = renderList()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Not synced: Wallet no longer available',
      }),
    )
    expect(
      await screen.findByText('Pick another wallet and save.'),
    ).toBeTruthy()
    expect(onRowClick).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Retry now' }))
    expect(retrySync).toHaveBeenCalledWith('transaction', 'tx-flagged')
    expect(onRowClick).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('retries a transfer by its transfer id, and offers no Edit while it waits', async () => {
    renderList()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Not synced: Not synced yet',
      }),
    )
    expect(
      await screen.findByText('We’ll keep retrying automatically.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Retry now' }))
    expect(retrySync).toHaveBeenCalledWith('transfer', 'transfer-1')
  })
})
