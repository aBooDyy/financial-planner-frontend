import { useCallback, useMemo, useState } from 'react'
import { buildCatalog } from '#/features/categories/data/catalog'
import { buildDedupeIndex } from '#/features/import/data/dedupe'
import {
  draftForFile,
  fallbackCategoryOf,
  toMapping,
} from '#/features/import/data/mapping'
import { categoryOptions } from '#/features/import/data/matching'
import { rowReader, scanRowsSync } from '#/features/import/data/rowScan'
import type { LocalCategory } from '#/db/types'
import type { LedgerTransaction } from '#/features/import/data/dedupe'
import type { MappingDraft } from '#/features/import/data/mapping'
import type { MerchantIndex } from '#/features/merchants/data/matching'
import type { WalletGroupOption } from '#/features/balances/data/selectors'
import type { CurrencyCode } from '#/lib/currency'
import type {
  CsvImport,
  ImportFileInfo,
} from '#/features/import/hooks/useCsvImport'
import type { Dialect, RowContext } from '#/features/import/data/types'

/**
 * A working stand-in for `useCsvImport` in component tests: the same pass and the same lazy
 * reader, run synchronously, so a step's writes into the mapping really do reach the rows.
 * Test asset only.
 */

export const stubDialect: Dialect = {
  delimiter: ',',
  quote: '"',
  encoding: 'utf-8',
  decimal: '.',
  skipRows: 0,
  hasHeader: true,
}

export type StubSeed = {
  headers: string[]
  matrix: string[][]
  walletGroups?: WalletGroupOption[]
  walletCurrencies?: Record<string, CurrencyCode>
  /** The user's own category rows; empty means the built-in catalog. */
  categoryRows?: LocalCategory[]
  merchantIndex?: MerchantIndex
  ledger?: LedgerTransaction[]
  today?: string
  baseCurrency?: CurrencyCode
  amend?: (draft: MappingDraft) => MappingDraft
}

const NO_MERCHANTS: MerchantIndex = { merchants: [], aliases: [] }

export function useStubImport(seed: StubSeed): CsvImport {
  const baseCurrency = seed.baseCurrency ?? 'SAR'
  const merchantIndex = seed.merchantIndex ?? NO_MERCHANTS
  const walletGroups = useMemo(
    () => seed.walletGroups ?? [],
    [seed.walletGroups],
  )

  const catalog = useMemo(
    () => buildCatalog(seed.categoryRows ?? []),
    [seed.categoryRows],
  )
  const fallbackCategory = fallbackCategoryOf(catalog)

  const [draft, setDraft] = useState<MappingDraft>(() => {
    const seeded = draftForFile({
      dialect: stubDialect,
      headers: seed.headers,
      matrix: seed.matrix,
      currency: baseCurrency,
      fallbackCategory,
    })
    return seed.amend ? seed.amend(seeded) : seeded
  })

  const [suggestedRoles] = useState(() => draft.roles)

  const context: RowContext = useMemo(
    () => ({
      today: seed.today ?? '2026-09-01',
      walletCurrencies: seed.walletCurrencies ?? {},
    }),
    [seed.today, seed.walletCurrencies],
  )

  const categories = useMemo(() => categoryOptions(catalog), [catalog])

  const mapping = useMemo(() => toMapping(draft), [draft])

  const ledgerIndex = useMemo(
    () => buildDedupeIndex(seed.ledger ?? []),
    [seed.ledger],
  )

  const scan = useMemo(
    () =>
      mapping === null
        ? null
        : scanRowsSync({
            matrix: seed.matrix,
            mapping,
            context,
            merchants: merchantIndex,
            ledger: ledgerIndex,
          }),
    [mapping, seed.matrix, context, merchantIndex, ledgerIndex],
  )

  const reader = useMemo(
    () =>
      mapping === null
        ? null
        : rowReader({
            matrix: seed.matrix,
            mapping,
            context,
            merchants: merchantIndex,
            duplicates: scan?.duplicates,
          }),
    [mapping, seed.matrix, context, merchantIndex, scan],
  )

  const rowAt = useCallback(
    (index: number) => reader?.at(index) ?? null,
    [reader],
  )

  const [file] = useState<ImportFileInfo>(() => ({
    name: 'statement.csv',
    size: 2048,
    dialect: stubDialect,
    headers: seed.headers,
    rowCount: seed.matrix.length,
    columnCount: seed.headers.length,
    sample: seed.matrix.slice(0, 5),
  }))

  const updateMapping = useCallback(
    (updater: (current: MappingDraft, matrix: string[][]) => MappingDraft) =>
      setDraft((current) => updater(current, seed.matrix)),
    [seed.matrix],
  )

  return useMemo(
    () =>
      ({
        step: 'values',
        furthest: 'review',
        canGoTo: () => true,
        read: { status: 'ready' },
        scan: {
          running: false,
          done: seed.matrix.length,
          total: seed.matrix.length,
          result: scan,
        },
        file,
        draft,
        mapping,
        suggestedRoles,
        matrix: seed.matrix,
        rowAt,
        context,
        walletGroups,
        catalog,
        categories,
        fallbackCategory,
        merchantIndex,
        baseCurrency,
        templateId: 'one-time',
        actions: {
          openFile: () => undefined,
          cancelRead: () => undefined,
          setDialect: () => undefined,
          chooseTemplate: () => undefined,
          updateMapping,
          goTo: () => undefined,
          next: () => undefined,
          back: () => undefined,
          reset: () => undefined,
        },
      }) as unknown as CsvImport,
    [
      file,
      draft,
      mapping,
      suggestedRoles,
      scan,
      rowAt,
      seed.matrix,
      context,
      walletGroups,
      catalog,
      categories,
      fallbackCategory,
      merchantIndex,
      baseCurrency,
      updateMapping,
    ],
  )
}
