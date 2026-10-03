// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { db } from '#/db/db'
import type {
  LocalBalanceNode,
  LocalGoal,
  LocalSetAside,
  LocalTransaction,
} from '#/db/types'
import { walletSetAsides } from '#/features/setAsides/data/totals'
import { walletDeltas } from '#/features/transactions/data/ledger'
import { activeNodes } from '#/features/wallets/data/archive'
import {
  buildWalletsView,
  heldCurrencies,
} from '#/features/wallets/data/selectors'
import { useHeldCurrencies } from '#/features/settings/hooks/useHeldCurrencies'
import { useWalletDeltas } from '#/features/transactions/hooks/useWalletDeltas'
import { mergeRates } from '#/lib/config/rates'
import { useWallets } from './useWallets'

/**
 * The Wallets page never holds the ledger's rows: balances come from the running totals and
 * the rest from the planner's shared read. These pin that nothing it shows changes from the
 * every-row derivation, and that no balance is shown before everything it derives from has
 * landed.
 */

const meta = {
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
} as const

const node = (
  over: Partial<LocalBalanceNode> & { id: string },
): LocalBalanceNode => ({
  kind: 'wallet',
  parentId: null,
  name: over.id,
  color: '#1F9D6B',
  icon: null,
  note: null,
  position: 0,
  collapsed: false,
  archivedAt: null,
  amount: 100_000,
  currency: 'SAR',
  ...meta,
  ...over,
})

// Only the fields a balance or goal progress reads; the category fields are irrelevant here.
const tx = (
  over: Partial<LocalTransaction> & { id: string },
): LocalTransaction =>
  ({
    type: 'spend',
    amount: 1_000,
    currency: 'SAR',
    walletId: 'checking',
    goalId: null,
    merchantId: null,
    date: '2026-06-10',
    note: null,
    source: null,
    transferId: null,
    plannedId: null,
    ...meta,
    ...over,
  }) as LocalTransaction

const GOAL: LocalGoal = {
  id: 'trip',
  name: 'Trip',
  currency: 'SAR',
  color: '#EC4899',
  position: 0,
  amount: null,
  target: 500_000,
  dueDate: '2027-01-01',
  mustHave: false,
  saveWalletId: null,
  useCategoryId: null,
  closedAt: null,
  pausedAt: null,
  plannedAt: null,
  planAmount: null,
  planCount: null,
  planStart: null,
  setAsideDay: null,
  ...meta,
}

const SET_ASIDE: LocalSetAside = {
  id: 'a1',
  goalId: 'trip',
  billId: null,
  occurrence: null,
  source: 'wallet',
  walletId: 'checking',
  externalLabel: null,
  amount: 60_000,
  currency: 'SAR',
  note: null,
  position: 0,
  date: '2026-05-01',
  plannedId: null,
  releasedAt: null,
  releasedById: null,
  movedByTransferId: null,
  ...meta,
}

const NODES = [
  node({ id: 'bank', kind: 'group', amount: null, currency: null }),
  node({ id: 'checking', parentId: 'bank' }),
  node({ id: 'dollars', currency: 'USD', amount: 50_000 }),
  node({ id: 'old', archivedAt: '2026-01-01T00:00:00Z' }),
  node({ id: 'gone', deleted: 1 }),
]

const TXNS = [
  tx({ id: 't1', amount: 12_345 }),
  tx({
    id: 't2',
    type: 'income',
    amount: 40_000,
    walletId: 'dollars',
    currency: 'USD',
  }),
  tx({ id: 't3', amount: 20_000, goalId: 'trip' }),
  tx({ id: 't4', amount: 9_999, goalId: 'trip', deleted: 1 }),
  tx({ id: 't5', amount: 700, currency: 'EUR', deleted: 1 }),
  tx({ id: 't6', type: 'transfer_out', amount: 5_000, transferId: 'x' }),
  tx({
    id: 't7',
    type: 'transfer_in',
    amount: 5_000,
    walletId: 'old',
    transferId: 'x',
  }),
  tx({ id: 't8', type: 'adjustment_in', amount: 321, walletId: 'gone' }),
]

// Unmounting closes the shared reads, so each test starts from nothing loaded.
afterEach(cleanup)

beforeAll(async () => {
  await db.balanceNodes.bulkPut(NODES)
  await db.transactions.bulkPut(TXNS)
  await db.goals.bulkPut([GOAL])
  await db.setAsides.bulkPut([SET_ASIDE])
})

/** What the page showed when it held every row. */
function fromEveryRow() {
  const rates = mergeRates([])
  const live = NODES.filter((n) => n.deleted === 0)
  const deltas = walletDeltas(live, TXNS, rates)
  const reservations = walletSetAsides([SET_ASIDE], [GOAL], [], live, rates)
  return {
    deltas,
    view: buildWalletsView(
      activeNodes(live),
      'SAR',
      rates,
      deltas,
      reservations,
    ),
    held: heldCurrencies('SAR', [live, [GOAL], [], TXNS, [SET_ASIDE], []]),
  }
}

describe('useWallets', () => {
  it('shows exactly what the full ledger read showed', async () => {
    const { result } = renderHook(() => useWallets())
    await waitFor(() => expect(result.current.balancesLoading).toBe(false))
    const expected = fromEveryRow()
    expect(result.current.deltas).toEqual(expected.deltas)
    expect(result.current.view).toEqual(expected.view)
    // The set-aside earmarks the wallet.
    expect(result.current.view.rows.some((r) => r.hasSetAside)).toBe(true)
  })

  it('shares one ledger read with every other consumer of the deltas', async () => {
    const rates = mergeRates([])
    const { result } = renderHook(() => ({
      a: useWalletDeltas(rates),
      b: useWalletDeltas(rates),
    }))
    await waitFor(() => expect(result.current.a).toBeDefined())
    expect(result.current.b).toBe(result.current.a)
    expect(result.current.a).toEqual(fromEveryRow().deltas)
  })

  it('never offers a figure before everything it derives from has landed', async () => {
    const seen: Array<{ loading: boolean; total: string }> = []
    const { result } = renderHook(() => {
      const w = useWallets()
      seen.push({ loading: w.balancesLoading, total: w.view.grandTotalStr })
      return w
    })
    await waitFor(() => expect(result.current.balancesLoading).toBe(false))
    const total = fromEveryRow().view.grandTotalStr
    expect(seen[0].loading).toBe(true)
    for (const render of seen.filter((r) => !r.loading))
      expect(render.total).toBe(total)
  })
})

describe('useHeldCurrencies', () => {
  it('lists what the every-row read listed, deleted ledger rows included', async () => {
    const { result } = renderHook(() => useHeldCurrencies('SAR', []))
    const expected = fromEveryRow().held
    await waitFor(() => expect(result.current).toEqual(expected))
    expect(result.current).toContain('EUR')
  })
})
