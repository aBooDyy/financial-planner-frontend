// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useStubImport } from '#/features/import/__fixtures__/useStubImport'
import { emptyAliases } from '#/features/import/data/types'
import { useReviewRows } from './useReviewRows'
import type { StubSeed } from '#/features/import/__fixtures__/useStubImport'
import type { LedgerTransaction } from '#/features/import/data/dedupe'

/**
 * The user's row-level decisions are the one thing in the wizard that a mapping change must
 * not throw away — they are kept by row index and laid back over rows built from the file.
 */

const HEADERS = ['Date', 'Description', 'Amount', 'Account', 'Category']

const MATRIX = [
  ['2026-08-01', 'CARREFOUR HYPER', '-142.50', 'Main', 'Groceries'],
  ['2026-08-02', 'STC', '-89.00', 'Main', 'Groceries'],
  ['2026-08-04', 'ATM WITHDRAWAL', '-500.00', 'Main', 'Groceries'],
  ['2026-08-05', 'CORNER SHOP', '-34.00', 'Main', ''],
  ['2026-08-06', 'REFUND', 'N/A', 'Main', 'Groceries'],
]

const LEDGER: LedgerTransaction[] = [
  {
    id: 't-atm',
    date: '2026-08-04',
    type: 'spend',
    amount: 50000,
    currency: 'SAR',
    walletId: 'w1',
    merchantId: null,
    note: 'ATM WITHDRAWAL',
  },
]

const ANSWERED = () => ({
  ...emptyAliases(),
  wallets: { main: { kind: 'wallet' as const, walletId: 'w1' } },
  categories: {
    groceries: {
      kind: 'category' as const,
      categoryId: 'cat-groceries',
    },
  },
})

const seed: StubSeed = {
  headers: HEADERS,
  matrix: MATRIX,
  walletGroups: [{ label: null, wallets: [{ id: 'w1', name: 'Main' }] }],
  walletCurrencies: { w1: 'SAR' },
  ledger: LEDGER,
  amend: (draft) => ({ ...draft, aliases: ANSWERED() }),
}

const mounted = () =>
  renderHook(() => {
    const csv = useStubImport(seed)
    return { csv, review: useReviewRows(csv) }
  })

afterEach(cleanup)

describe('useReviewRows', () => {
  it('counts the file from the pass alone', () => {
    const { result } = mounted()

    expect(result.current.review.counts).toEqual({
      total: 5,
      ok: 2,
      warning: 1,
      error: 1,
      duplicate: 1,
    })
    // The duplicate is out by default; the unreadable row can never be in.
    expect(result.current.review.committable).toHaveLength(3)
    expect(result.current.review.excluded).toHaveLength(1)
    expect(result.current.review.excludedDuplicates).toBe(1)
  })

  it('keeps an exclusion and a correction across a mapping change', () => {
    const { result } = mounted()

    act(() => result.current.review.toggleRow(0, true))
    act(() => result.current.review.editRow(4, { amountMinor: 3400 }))

    expect(result.current.review.counts.error).toBe(0)
    expect(result.current.review.committable).toEqual(
      expect.not.arrayContaining([0]),
    )

    act(() =>
      result.current.csv.actions.updateMapping((draft) => ({
        ...draft,
        amountUnit: 'minor',
      })),
    )

    // Both survived, and the correction is still a patch: the row's other fields moved
    // with the mapping, the amount the user typed did not.
    expect(result.current.review.patchFor(4)).toEqual({ amountMinor: 3400 })
    expect(result.current.review.counts.error).toBe(0)
    expect(result.current.review.committable).toEqual(
      expect.not.arrayContaining([0]),
    )
    const fixed = result.current.review.rowAt(
      result.current.review.visible.indexOf(4),
    )
    expect(fixed?.draft?.amount).toBe(3400)
    const moved = result.current.review.rowAt(
      result.current.review.visible.indexOf(1),
    )
    expect(moved?.draft?.amount).toBe(89)
  })

  it('puts the duplicates back when the toggle says so', () => {
    const { result } = mounted()

    expect(result.current.review.committable).toHaveLength(3)
    act(() => result.current.review.setSkipDuplicates(false))

    expect(result.current.review.committable).toHaveLength(4)
    expect(result.current.review.excluded).toHaveLength(0)
    // The duplicate is still a duplicate — it is included, not reclassified.
    expect(result.current.review.counts.duplicate).toBe(1)
  })

  it('scopes the header checkbox to the filter, never to the file', () => {
    const { result } = mounted()

    act(() => result.current.review.setFilter('warning'))
    expect(result.current.review.visible).toHaveLength(1)

    act(() => result.current.review.setVisibleExcluded(true))
    expect(result.current.review.committable).toHaveLength(2)

    act(() => result.current.review.setFilter('error'))
    // An unreadable row cannot be included, so the header checkbox leaves it alone.
    act(() => result.current.review.setVisibleExcluded(false))
    expect(result.current.review.committable).toHaveLength(2)
  })

  it('builds the skipped rows only when they are asked for, in the table’s order', () => {
    const { result } = mounted()

    act(() => result.current.review.toggleRow(1, true))
    const skipped = result.current.review.rowsFor(
      result.current.review.excluded,
    )

    expect(skipped.map((row) => row.index)).toEqual([2, 1])
    expect(skipped.every((row) => row.excluded)).toBe(true)
  })
})

describe('useReviewRows — transfers', () => {
  const transferSeed: StubSeed = {
    headers: HEADERS,
    matrix: [
      ['2026-08-01', 'Send to Savings', '-300.00', 'Main', 'Transfer'],
      ['2026-08-01', 'Received from Main', '300.00', 'Savings', 'Transfer'],
      ['2026-08-02', 'Coffee', '-10.00', 'Main', 'Groceries'],
      ['2026-08-03', 'Moved', '50.00', 'Savings', 'Transfer'],
    ],
    walletGroups: [
      {
        label: null,
        wallets: [
          { id: 'w1', name: 'Main' },
          { id: 'w2', name: 'Savings' },
        ],
      },
    ],
    walletCurrencies: { w1: 'SAR', w2: 'SAR' },
    amend: (draft) => ({
      ...draft,
      aliases: {
        ...emptyAliases(),
        wallets: {
          main: { kind: 'wallet', walletId: 'w1' },
          savings: { kind: 'wallet', walletId: 'w2' },
        },
        categories: {
          transfer: { kind: 'transfer' },
          groceries: {
            kind: 'category',
            categoryId: 'cat-groceries',
          },
        },
      },
    }),
  }

  const mountedTransfers = () =>
    renderHook(() => {
      const csv = useStubImport(transferSeed)
      return { csv, review: useReviewRows(csv) }
    })

  it('counts a pair once and keeps its sides next to each other for the commit', () => {
    const { result } = mountedTransfers()
    expect(result.current.review.plan).toEqual({
      transactions: 1,
      transfers: 1,
    })
    const { committable } = result.current.review
    const at = committable.indexOf(0)
    expect(committable[at + 1]).toBe(1)
    // The side with no other wallet is an error, and never written.
    expect(committable).not.toContain(3)
  })

  it('leaves both sides out when either is left out, and brings both back', () => {
    const { result } = mountedTransfers()
    act(() => result.current.review.toggleRow(1, true))
    expect(result.current.review.plan).toEqual({
      transactions: 1,
      transfers: 0,
    })
    expect(result.current.review.excluded).toEqual(
      expect.arrayContaining([0, 1]),
    )
    act(() => result.current.review.toggleRow(0, false))
    expect(result.current.review.plan.transfers).toBe(1)
  })

  it('splits the pair when a matched field changes, each side then naming its own', () => {
    const { result } = mountedTransfers()
    act(() => result.current.review.editRow(0, { amountMinor: 30_100 }))
    expect(result.current.review.patchFor(1)).toEqual({ unpaired: true })
    // Both notes name the other account, so both stand alone as transfers.
    expect(result.current.review.plan).toEqual({
      transactions: 1,
      transfers: 2,
    })
    expect(result.current.review.counts.warning).toBe(2)
  })
})
