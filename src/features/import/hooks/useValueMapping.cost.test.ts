// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { useCallback, useMemo, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubDialect } from '#/features/import/__fixtures__/useStubImport'
import { draftForFile } from '#/features/import/data/mapping'
import { buildCatalog } from '#/features/categories/data/catalog'
import { categoryOptions } from '#/features/import/data/matching'
import { SKIP } from '#/features/import/data/values'
import type { MappingDraft } from '#/features/import/data/mapping'
import type * as Matching from '#/features/import/data/matching'
import type { CsvImport } from '#/features/import/hooks/useCsvImport'
import type { ValueKind } from '#/features/import/data/values'
import { useValueMapping } from './useValueMapping'

/**
 * What one answer in step ③ costs, counted rather than timed.
 *
 * The defect this pins: `columns` was memoised on the whole draft, so every alias written
 * here produced a new one — the distinct values were taken again, which is a walk over
 * **every row of the file**, and the matcher ran again over every distinct value. Neither
 * question can be changed by an answer. Both counts are hardware-independent: a walked row
 * is a row, a matched value is a call.
 */

const ROWS = 4000
const ACCOUNTS = 10
const CATEGORIES = 10
const MERCHANTS = 20

const cost = { rowsWalked: 0, valuesMatched: 0 }

vi.mock('#/features/import/data/matching', async (original) => {
  const actual: typeof Matching = await original()
  return {
    ...actual,
    distinctValues: (
      rows: ReadonlyArray<ReadonlyArray<string>>,
      column: number,
    ) => {
      cost.rowsWalked += rows.length
      return actual.distinctValues(rows, column)
    },
    resolveWallet: (
      raw: string,
      wallets: ReadonlyArray<Matching.WalletOption>,
    ) => {
      cost.valuesMatched += 1
      return actual.resolveWallet(raw, wallets)
    },
  }
})

const HEADERS = ['Date', 'Description', 'Amount', 'Account', 'Category']

const MATRIX: string[][] = Array.from({ length: ROWS }, (_unused, at) => [
  `2026-08-${String((at % 28) + 1).padStart(2, '0')}`,
  `SHOP ${at % MERCHANTS}`,
  `-${((at % 900) + 1) / 100}`,
  `ACCOUNT ${at % ACCOUNTS}`,
  `CAT ${at % CATEGORIES}`,
])

const WALLET_GROUPS = [
  { label: null, wallets: [{ id: 'w1', name: 'Main' }] },
] as unknown as CsvImport['walletGroups']

type Updater = (current: MappingDraft, matrix: string[][]) => MappingDraft

/**
 * Only what the hook reads. A fuller stand-in would run the whole spine over the same matrix
 * and drown the two counts this test is about.
 */
const CATALOG = buildCatalog([])

function useValueStep() {
  const [draft, setDraft] = useState<MappingDraft>(() =>
    draftForFile({
      dialect: stubDialect,
      headers: HEADERS,
      matrix: MATRIX,
      currency: 'SAR',
      fallbackCategory: 'other',
    }),
  )

  const updateMapping = useCallback(
    (updater: Updater) => setDraft((current) => updater(current, MATRIX)),
    [],
  )

  const csv = useMemo(
    () =>
      ({
        matrix: MATRIX,
        walletGroups: WALLET_GROUPS,
        catalog: CATALOG,
        categories: categoryOptions(CATALOG),
        merchantIndex: { merchants: [], aliases: [] },
        context: { today: '2026-09-01', walletCurrencies: { w1: 'SAR' } },
        actions: { updateMapping },
      }) as unknown as CsvImport,
    [updateMapping],
  )

  return { values: useValueMapping(csv, draft), updateMapping }
}

/** Every value the file spells, answered one at a time — the way a user answers them. */
const PICKS: ReadonlyArray<readonly [ValueKind, string]> = [
  ...Array.from(
    { length: ACCOUNTS },
    (_u, at) => ['wallet', `account ${at}`] as const,
  ),
  ...Array.from(
    { length: CATEGORIES },
    (_u, at) => ['category', `cat ${at}`] as const,
  ),
  ...Array.from(
    { length: MERCHANTS },
    (_u, at) => ['merchant', `shop ${at}`] as const,
  ),
]

// `globals` is off in this project, so Testing Library's auto-cleanup never registers.
afterEach(cleanup)

describe('what one answer in step ③ costs', () => {
  beforeEach(() => {
    cost.rowsWalked = 0
    cost.valuesMatched = 0
  })

  it('answers every value without re-walking the file or re-running the matcher', () => {
    const step = renderHook(() => useValueStep())

    // Opening the step reads each mapped column once and matches each account name once.
    expect(cost.rowsWalked).toBeGreaterThan(0)
    expect(cost.valuesMatched).toBeGreaterThan(0)
    const settled = { ...cost }

    for (const [kind, key] of PICKS) {
      act(() => step.result.current.values.setValue(kind, key, SKIP))
    }

    expect(PICKS).toHaveLength(40)
    // The defect was exactly this product: 40 × 4 000 rows walked to answer 40 questions.
    expect(cost.rowsWalked).toBe(settled.rowsWalked)
    expect(cost.valuesMatched).toBe(settled.valuesMatched)

    // The answers were real: every account now reads as one the user settled.
    const wallets = step.result.current.values.groups.find(
      (group) => group.kind === 'wallet',
    )
    expect(wallets?.rows.filter((row) => row.value === SKIP)).toHaveLength(
      ACCOUNTS,
    )
  })

  it('still reads the file again when the columns themselves change', () => {
    const step = renderHook(() => useValueStep())
    const settled = { ...cost }

    act(() =>
      step.result.current.updateMapping((current) => ({
        ...current,
        roles: current.roles.map((role) =>
          role === 'merchant' ? 'note' : role,
        ),
      })),
    )

    // A different set of columns is a different question, and it is paid for.
    expect(cost.rowsWalked).toBeGreaterThan(settled.rowsWalked)
    expect(
      step.result.current.values.groups.some(
        (group) => group.kind === 'merchant',
      ),
    ).toBe(false)
  })
})
