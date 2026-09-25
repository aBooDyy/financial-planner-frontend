// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { normalizeKey } from '#/features/import/data/matching'
import type { LocalBalanceNode } from '#/db/types'
import type { CsvReadResult } from '#/features/import/data/csv/read'
import type { MappingDraft } from '#/features/import/data/mapping'
import type * as RowScan from '#/features/import/data/rowScan'
import { useCsvImport } from './useCsvImport'

/**
 * What the wizard costs, counted rather than timed.
 *
 * The defect this pins: step ③ writes one alias per distinct value, every write produced a
 * new `Mapping`, and the spine re-derived **every row of the file** for each one. A
 * statement with forty distinct accounts, categories and merchants cost forty complete
 * passes over the file — O(values × rows) — and the user called it "sooooo laggy".
 *
 * These counts are the regression test. They are hardware-independent: a pass is a call, a
 * row is a call, and the numbers below are exact.
 */

const ROWS = 5000
const ACCOUNTS = 10
const CATEGORIES = 10
const MERCHANTS = 20

const cost = { scans: 0, rowsScanned: 0, rowsBuilt: 0 }

vi.mock('#/features/import/data/rowScan', async (original) => {
  const actual: typeof RowScan = await original()
  return {
    ...actual,
    scanRows: (input: RowScan.ScanInput, options?: RowScan.ScanOptions) => {
      cost.scans += 1
      cost.rowsScanned += input.matrix.length
      return actual.scanRows(input, options)
    },
    rowReader: (input: RowScan.RowReaderInput) => {
      const reader = actual.rowReader(input)
      return {
        at: (index: number) => {
          cost.rowsBuilt += 1
          return reader.at(index)
        },
      }
    },
  }
})

const parseCsvFile = vi.fn()

vi.mock('#/features/import/data/csv/workerClient', () => ({
  parseCsvFile: (...args: unknown[]) => parseCsvFile(...args),
}))

const MATRIX: string[][] = Array.from({ length: ROWS }, (_unused, at) => [
  `2026-08-${String((at % 28) + 1).padStart(2, '0')}`,
  `SHOP ${at % MERCHANTS}`,
  `-${((at % 900) + 1) / 100}`,
  `ACCOUNT ${at % ACCOUNTS}`,
  `CAT ${at % CATEGORIES}`,
])

const READ: CsvReadResult = {
  dialect: {
    delimiter: ',',
    quote: '"',
    encoding: 'utf-8',
    decimal: '.',
    skipRows: 0,
    hasHeader: true,
  },
  headers: ['Date', 'Description', 'Amount', 'Account', 'Category'],
  rows: MATRIX,
  rowCount: ROWS,
  columnCount: 5,
}

const wallet: LocalBalanceNode = {
  id: 'w1',
  kind: 'wallet',
  parentId: null,
  name: 'Main',
  color: '#000',
  icon: null,
  note: null,
  position: 0,
  collapsed: false,
  archivedAt: null,
  amount: 0,
  currency: 'SAR',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: '1',
  dirty: 0,
  deleted: 0,
}

/** Every value the file spells, the way step ③ answers them: one alias per pick. */
const PICKS: Array<(draft: MappingDraft) => MappingDraft> = [
  ...Array.from({ length: ACCOUNTS }, (_u, at) => (draft: MappingDraft) => ({
    ...draft,
    aliases: {
      ...draft.aliases,
      wallets: {
        ...draft.aliases.wallets,
        [normalizeKey(`ACCOUNT ${at}`)]: {
          kind: 'wallet' as const,
          walletId: 'w1',
        },
      },
    },
  })),
  ...Array.from({ length: CATEGORIES }, (_u, at) => (draft: MappingDraft) => ({
    ...draft,
    aliases: {
      ...draft.aliases,
      categories: {
        ...draft.aliases.categories,
        [normalizeKey(`CAT ${at}`)]: {
          kind: 'category' as const,
          category: 'other',
          subcategory: null,
        },
      },
    },
  })),
  ...Array.from({ length: MERCHANTS }, (_u, at) => (draft: MappingDraft) => ({
    ...draft,
    aliases: {
      ...draft.aliases,
      merchants: {
        ...draft.aliases.merchants,
        [normalizeKey(`SHOP ${at}`)]: { kind: 'skip' as const },
      },
    },
  })),
]

const openedWizard = async () => {
  const wizard = renderHook(() => useCsvImport())
  await act(async () => {
    wizard.result.current.actions.openFile(new File(['x'], 'statement.csv'))
  })
  await waitFor(() => expect(wizard.result.current.file).not.toBeNull())
  return wizard
}

const settled = async (wizard: Awaited<ReturnType<typeof openedWizard>>) => {
  await waitFor(() => expect(wizard.result.current.scan.running).toBe(false), {
    timeout: 20000,
  })
}

// `globals` is off in this project, so Testing Library's auto-cleanup never registers —
// and a wizard left mounted would answer the next test's database writes with a pass.
afterEach(cleanup)

describe('what the wizard reads', () => {
  beforeEach(async () => {
    cost.scans = 0
    cost.rowsScanned = 0
    cost.rowsBuilt = 0
    parseCsvFile.mockReset()
    parseCsvFile.mockResolvedValue(READ)
    await db.balanceNodes.clear()
    await db.transactions.clear()
    await db.balanceNodes.put(wallet)
  })

  it('reads nothing at all before a step asks a whole-file question', async () => {
    const wizard = await openedWizard()

    expect(cost.scans).toBe(0)
    expect(cost.rowsScanned).toBe(0)
    expect(wizard.result.current.scan.result).toBeNull()
    // The matrix is there from the moment the file is read — that is what ① – ③ answer from.
    expect(wizard.result.current.matrix).toHaveLength(ROWS)
  })

  it('answers every value in step ③ without reading the file once', async () => {
    const wizard = await openedWizard()
    await act(async () => wizard.result.current.actions.goTo('values'))

    for (const pick of PICKS) {
      act(() => wizard.result.current.actions.updateMapping(pick))
    }

    expect(PICKS).toHaveLength(40)
    // The defect was exactly this product: 40 × 5 000 = 200 000 rows derived.
    expect(cost.scans).toBe(0)
    expect(cost.rowsScanned).toBe(0)
    expect(cost.rowsBuilt).toBe(0)
    // Every answer did land in the mapping — the picks were real.
    expect(
      Object.keys(wizard.result.current.mapping?.aliases.wallets ?? {}),
    ).toHaveLength(ACCOUNTS)
  })

  it('reads the file once when review is entered, and not again unless the mapping changed', async () => {
    const wizard = await openedWizard()
    await act(async () => wizard.result.current.actions.goTo('values'))
    for (const pick of PICKS) {
      act(() => wizard.result.current.actions.updateMapping(pick))
    }

    await act(async () => wizard.result.current.actions.goTo('review'))
    await settled(wizard)

    expect(cost.scans).toBe(1)
    expect(cost.rowsScanned).toBe(ROWS)
    expect(wizard.result.current.scan.result?.total).toBe(ROWS)

    // Stepping back to ③ and returning must not read the file again.
    await act(async () => wizard.result.current.actions.goTo('values'))
    await act(async () => wizard.result.current.actions.goTo('review'))
    await settled(wizard)
    expect(cost.scans).toBe(1)

    // Changing an answer does invalidate it — the counts would otherwise be a lie.
    await act(async () => wizard.result.current.actions.goTo('values'))
    act(() =>
      wizard.result.current.actions.updateMapping((draft) => ({
        ...draft,
        defaults: { ...draft.defaults, walletId: 'w1' },
      })),
    )
    expect(cost.scans).toBe(1)
    await act(async () => wizard.result.current.actions.goTo('review'))
    await settled(wizard)
    expect(cost.scans).toBe(2)
  })

  it('a background pull that changed nothing costs no pass, and keeps the one held', async () => {
    const wizard = await openedWizard()
    await act(async () => wizard.result.current.actions.goTo('review'))
    await settled(wizard)
    expect(cost.scans).toBe(1)
    const held = wizard.result.current.scan.result

    // What a pull does: every row it receives written back, moved or not. Each write
    // re-emits its live query with a brand-new array.
    await act(async () => {
      await db.balanceNodes.put(wallet)
      await db.transactions.toArray()
    })
    await settled(wizard)

    expect(cost.scans).toBe(1)
    // The pass is still the same object, so the review screen never unmounted.
    expect(wizard.result.current.scan.result).toBe(held)

    // A real change still invalidates it — the counts would otherwise be a lie.
    await act(async () => {
      await db.balanceNodes.put({ ...wallet, id: 'w2', name: 'Savings' })
    })
    await settled(wizard)
    expect(cost.scans).toBe(2)
  })

  it('costs the whole session a couple of passes, not one per answer', async () => {
    const wizard = await openedWizard()
    await act(async () => wizard.result.current.actions.goTo('columns'))
    await settled(wizard)
    await act(async () => wizard.result.current.actions.goTo('values'))
    for (const pick of PICKS) {
      act(() => wizard.result.current.actions.updateMapping(pick))
    }
    await act(async () => wizard.result.current.actions.goTo('review'))
    await settled(wizard)

    // Step ② asks a whole-file question of its own (how many rows each issue touches),
    // so a full session is its pass plus review's — never one per value answered.
    expect(cost.scans).toBe(2)
    expect(cost.rowsScanned).toBe(2 * ROWS)
    expect(cost.rowsScanned).toBeLessThan(PICKS.length * ROWS)
  })
})
