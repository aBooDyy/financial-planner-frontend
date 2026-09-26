import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import { walletGroupOptions } from '#/features/wallets/data/selectors'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import { parseCsvFile } from '#/features/import/data/csv/workerClient'
import { CsvFileError } from '#/features/import/data/csv/errors'
import { buildDedupeIndex, toLedgerEntry } from '#/features/import/data/dedupe'
import { buildCatalog } from '#/features/categories/data/catalog'
import {
  draftForFile,
  fallbackCategoryOf,
  toMapping,
} from '#/features/import/data/mapping'
import { categoryOptions } from '#/features/import/data/matching'
import { rowReader, scanRows } from '#/features/import/data/rowScan'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { MerchantIndex } from '#/features/merchants/data/matching'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import type { CurrencyCode } from '#/lib/currency'
import type { CategoryOption } from '#/features/import/data/matching'
import type { CsvFileErrorCode } from '#/features/import/data/csv/errors'
import type { CsvReadResult } from '#/features/import/data/csv/read'
import type { MappingDraft } from '#/features/import/data/mapping'
import type { RowScan } from '#/features/import/data/rowScan'
import type {
  ColumnRole,
  Dialect,
  Mapping,
  ParsedRow,
  RowContext,
} from '#/features/import/data/types'

/**
 * The CSV wizard's spine. It owns the step, the file, the mapping being answered and the
 * **raw matrix** every step reads from — every step component is presentation over this one
 * object.
 *
 * Nothing here holds a derived row. Steps ① – ③ answer from the matrix alone, so picking a
 * value costs nothing over the file; the whole-file questions (how many rows are ready,
 * what repeats what, what order the table shows) are answered by **one streaming pass**
 * (`scanRows`) run for the step that asks them and re-run only when the mapping changes.
 * Rows themselves are built one at a time, on the way to the screen, by `rowAt`.
 *
 * The matrix is held for as long as a file is open, deliberately: every mapping change,
 * every row the review table shows and the skipped-rows download read the file's own cells
 * again. It is dropped by `reset()` and by unmounting, which also terminates a running
 * worker.
 */

export type ImportStep =
  | 'file'
  | 'columns'
  | 'values'
  | 'review'
  | 'committing'
  | 'done'

/** Wizard order. `committing` is entered by the commit, never by `next()`. */
export const IMPORT_STEPS: ReadonlyArray<ImportStep> = [
  'file',
  'columns',
  'values',
  'review',
  'committing',
  'done',
]

const stepIndex = (step: ImportStep): number => IMPORT_STEPS.indexOf(step)

/** The template the user picked in step ①; phase 8 supplies the saved ones. */
export const ONE_TIME_TEMPLATE = 'one-time'

export type ReadState =
  | { status: 'idle' }
  | { status: 'reading'; rows: number; total: number | null }
  | { status: 'ready' }
  | { status: 'failed'; code: CsvFileErrorCode; detail: string | null }

export type ScanState = {
  running: boolean
  done: number
  total: number
  /**
   * The last completed pass over the file now open, or null until one has run. It survives
   * a mapping change while the next pass runs — a screen showing counts a moment behind is
   * worth far more than one that throws the user back to a progress bar.
   */
  result: RowScan | null
}

export type ImportFileInfo = {
  name: string
  size: number
  dialect: Dialect
  headers: string[]
  rowCount: number
  columnCount: number
  /** The first rows, for the dialect preview and the column samples. */
  sample: string[][]
}

/** An update to the mapping. The matrix comes with it: moving the date role re-infers it. */
export type MappingUpdater = (
  draft: MappingDraft,
  matrix: ReadonlyArray<ReadonlyArray<string>>,
) => MappingDraft

const SAMPLE_ROWS = 5

type ScanProgress = { running: boolean; done: number; total: number }

const IDLE_SCAN: ScanProgress = { running: false, done: 0, total: 0 }

/**
 * The steps that ask a question about the whole file — step ② counts the rows each issue
 * touches, step ④ is the review itself. Everything before them reads the matrix directly.
 */
const WHOLE_FILE_STEPS: ReadonlyArray<ImportStep> = ['columns', 'review']

const NO_MATRIX: ReadonlyArray<ReadonlyArray<string>> = []

type SyncedRow = {
  id: string
  version: string
  updatedAt?: string
  deleted: 0 | 1
}

/**
 * What a table's live rows say, as one string. `version` moves on every write the server
 * acknowledges and `updatedAt` on every write made here, so two emissions sharing a stamp
 * hold the same data.
 */
const stampOf = (rows: ReadonlyArray<SyncedRow>): string =>
  rows.map((row) => `${row.id}:${row.version}:${row.updatedAt ?? ''}`).join('|')

/**
 * The live rows of one table, held across a re-emission that changed nothing.
 *
 * `useLiveQuery` republishes a new array on any write to the table, and a background pull
 * writes every row it receives whether or not it moved. The pass is keyed on the identity
 * of what it reads (the reference-stability rule in `.agent-context/import.md`), so without
 * this a pull would throw away a completed pass — and the review screen with it.
 */
function useLiveRows<TRow extends SyncedRow>(rows: TRow[] | undefined): TRow[] {
  const live = (rows ?? []).filter((row) => row.deleted === 0)
  const stamp = stampOf(live)
  const held = useRef<{ stamp: string; rows: TRow[] }>({ stamp, rows: live })
  if (held.current.stamp !== stamp) held.current = { stamp, rows: live }
  return held.current.rows
}

export function useCsvImport() {
  const [step, setStep] = useState<ImportStep>('file')
  const [furthest, setFurthest] = useState<ImportStep>('file')
  const [read, setRead] = useState<ReadState>({ status: 'idle' })
  const [source, setSource] = useState<CsvReadResult | null>(null)
  const [meta, setMeta] = useState<{ name: string; size: number } | null>(null)
  const [draft, setDraft] = useState<MappingDraft | null>(null)
  const [suggestedRoles, setSuggestedRoles] = useState<ColumnRole[]>([])
  const [templateId, setTemplateId] = useState<string>(ONE_TIME_TEMPLATE)
  const [scanned, setScanned] = useState<{
    key: unknown
    source: CsvReadResult
    result: RowScan
  } | null>(null)
  const [progress, setProgress] = useState<ScanProgress>(IDLE_SCAN)

  const fileRef = useRef<File | null>(null)
  const overridesRef = useRef<Partial<Dialect>>({})
  const readAbort = useRef<AbortController | null>(null)

  // --- What the row rules need from the rest of the app ------------------------------

  const [today] = useState(() => ymd(startOfToday()))
  const nodeRows = useLiveQuery(() => db.balanceNodes.toArray())
  const settings = useLiveQuery(() => db.balanceSettings.get(SETTINGS_KEY))
  const transactionRows = useLiveQuery(() => db.transactions.toArray())
  const categoryRows = useLiveQuery(() => db.categories.toArray())
  const merchantRows = useLiveQuery(() => db.merchants.toArray())
  const aliasRows = useLiveQuery(() => db.merchantAliases.toArray())

  const nodes = useLiveRows(nodeRows)
  const transactions = useLiveRows(transactionRows)
  const categoryList = useLiveRows(categoryRows)
  const merchants = useLiveRows(merchantRows)
  const aliases = useLiveRows(aliasRows)

  const baseCurrency: CurrencyCode =
    settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY

  /**
   * Every live query resolves on its own tick, and each one that lands changes what a pass
   * would find. Waiting for all of them is the difference between one pass and five.
   */
  const dataReady =
    nodeRows !== undefined &&
    transactionRows !== undefined &&
    categoryRows !== undefined &&
    merchantRows !== undefined &&
    aliasRows !== undefined

  const walletGroups: WalletGroupOption[] = useMemo(
    () => walletGroupOptions(nodes),
    [nodes],
  )

  /** The user's own two-level catalog — every name, colour and child the wizard shows. */
  const catalog: CategoryCatalog = useMemo(
    () => buildCatalog(categoryList),
    [categoryList],
  )

  /** Every category a row may be filed under, flattened into the matcher's candidates. */
  const categories: CategoryOption[] = useMemo(
    () => categoryOptions(catalog),
    [catalog],
  )

  const fallbackCategory = fallbackCategoryOf(catalog)

  const context: RowContext = useMemo(() => {
    const walletCurrencies: Record<string, CurrencyCode> = {}
    const walletNames: Record<string, string> = {}
    for (const node of nodes) {
      if (node.kind !== 'wallet') continue
      walletNames[node.id] = node.name
      if (node.currency) walletCurrencies[node.id] = node.currency
    }
    return { today, walletCurrencies, walletNames }
  }, [nodes, today])

  const ledgerIndex = useMemo(
    () => buildDedupeIndex(transactions.map(toLedgerEntry)),
    [transactions],
  )

  // Memoised from the raw tables rather than taken from `useMerchantIndex`, whose object
  // is new on every render — which would re-run the derivation below on every render.
  const merchantIndex: MerchantIndex = useMemo(
    () => ({ merchants, aliases }),
    [merchants, aliases],
  )

  // --- Steps --------------------------------------------------------------------------

  const goTo = useCallback((next: ImportStep) => {
    setStep(next)
    setFurthest((reached) =>
      stepIndex(next) > stepIndex(reached) ? next : reached,
    )
  }, [])

  const canGoTo = useCallback(
    (target: ImportStep) => stepIndex(target) <= stepIndex(furthest),
    [furthest],
  )

  const next = useCallback(() => {
    const ahead = stepIndex(step) + 1
    // The commit is an explicit act, never the next arrow.
    if (ahead >= IMPORT_STEPS.length || IMPORT_STEPS[ahead] === 'committing') {
      return
    }
    goTo(IMPORT_STEPS[ahead])
  }, [step, goTo])

  const back = useCallback(() => {
    const behind = stepIndex(step) - 1
    if (behind >= 0) setStep(IMPORT_STEPS[behind])
  }, [step])

  // --- The file -----------------------------------------------------------------------

  const runRead = useCallback(
    async (file: File, overrides: Partial<Dialect>) => {
      readAbort.current?.abort()
      const controller = new AbortController()
      readAbort.current = controller
      setRead({ status: 'reading', rows: 0, total: null })
      try {
        const result = await parseCsvFile(file, {
          overrides,
          signal: controller.signal,
          onProgress: (done, total) =>
            setRead({ status: 'reading', rows: done, total }),
        })
        if (controller.signal.aborted) return
        setSource(result)
        setMeta({ name: file.name, size: file.size })
        const seed = draftForFile({
          dialect: result.dialect,
          headers: result.headers,
          matrix: result.rows,
          currency: baseCurrency,
          fallbackCategory,
        })
        setDraft(seed)
        setSuggestedRoles(seed.roles)
        setRead({ status: 'ready' })
      } catch (error) {
        if (controller.signal.aborted) return
        // The previous parse is kept: a wrong choice in Adjust must leave the file open
        // with its old reading, not drop the user back to the drop zone.
        const failure =
          error instanceof CsvFileError
            ? { code: error.code, detail: error.detail ?? null }
            : {
                code: 'import.file.unreadable' as CsvFileErrorCode,
                detail: null,
              }
        setRead({ status: 'failed', ...failure })
      } finally {
        if (readAbort.current === controller) readAbort.current = null
      }
    },
    [baseCurrency, fallbackCategory],
  )

  const openFile = useCallback(
    (file: File) => {
      fileRef.current = file
      overridesRef.current = {}
      setTemplateId(ONE_TIME_TEMPLATE)
      setSource(null)
      setDraft(null)
      setScanned(null)
      setProgress(IDLE_SCAN)
      void runRead(file, {})
    },
    [runRead],
  )

  /** Re-read the file the user's way. Detection is a proposal; this is the correction. */
  const setDialect = useCallback(
    (patch: Partial<Dialect>) => {
      const file = fileRef.current
      if (!file) return
      overridesRef.current = { ...overridesRef.current, ...patch }
      void runRead(file, overridesRef.current)
    },
    [runRead],
  )

  const cancelRead = useCallback(() => {
    readAbort.current?.abort()
    readAbort.current = null
    setRead({ status: 'idle' })
  }, [])

  // Leaving the wizard mid-parse must not leave a worker holding the whole file: aborting
  // the read is what terminates it.
  useEffect(
    () => () => {
      readAbort.current?.abort()
      readAbort.current = null
    },
    [],
  )

  const reset = useCallback(() => {
    readAbort.current?.abort()
    readAbort.current = null
    fileRef.current = null
    overridesRef.current = {}
    setStep('file')
    setFurthest('file')
    setRead({ status: 'idle' })
    setSource(null)
    setMeta(null)
    setDraft(null)
    setSuggestedRoles([])
    setTemplateId(ONE_TIME_TEMPLATE)
    setScanned(null)
    setProgress(IDLE_SCAN)
  }, [])

  // --- The mapping, the pass over the file, and one row at a time ----------------------

  // The matrix reaches the updater by ref so `updateMapping` stays identity-stable across
  // re-parses — every step component takes it as a prop.
  const sourceRowsRef = useRef<ReadonlyArray<ReadonlyArray<string>>>([])
  sourceRowsRef.current = source?.rows ?? []

  const updateMapping = useCallback((updater: MappingUpdater) => {
    setDraft((current) =>
      current === null ? current : updater(current, sourceRowsRef.current),
    )
  }, [])

  const mapping: Mapping | null = useMemo(
    () => (draft === null ? null : toMapping(draft)),
    [draft],
  )

  /** Everything a pass reads. Its identity is what decides whether another is owed. */
  const scanKey = useMemo(
    () => ({ mapping, source, context, merchantIndex, ledgerIndex }),
    [mapping, source, context, merchantIndex, ledgerIndex],
  )

  const fresh = scanned !== null && scanned.key === scanKey
  const wanted = WHOLE_FILE_STEPS.includes(step)

  useEffect(() => {
    if (mapping === null || source === null || !wanted || !dataReady) {
      setProgress((current) => (current === IDLE_SCAN ? current : IDLE_SCAN))
      return
    }
    // A pass the mapping has not invalidated is still the answer: stepping back to ③ and
    // returning must not read the file again.
    if (fresh) return

    const controller = new AbortController()
    const { signal } = controller
    const matrix = source.rows
    setProgress({ running: true, done: 0, total: matrix.length })
    void (async () => {
      try {
        const result = await scanRows(
          {
            matrix,
            mapping,
            context,
            merchants: merchantIndex,
            ledger: ledgerIndex,
          },
          {
            signal,
            onProgress: (done, total) => {
              if (!signal.aborted) setProgress({ running: true, done, total })
            },
          },
        )
        if (signal.aborted) return
        setScanned({ key: scanKey, source, result })
        setProgress({ running: false, done: result.total, total: result.total })
      } catch {
        if (!signal.aborted) setProgress(IDLE_SCAN)
      }
    })()
    return () => controller.abort()
  }, [
    wanted,
    fresh,
    dataReady,
    scanKey,
    mapping,
    source,
    context,
    merchantIndex,
    ledgerIndex,
  ])

  /**
   * A pass over *this* reading of the file still describes these rows. Only a re-read
   * retires it, because new row indices no longer point at the same lines — the same rule
   * `useReviewRows` invalidates the user's own row decisions by.
   */
  const usable = scanned !== null && scanned.source === source

  const scan: ScanState = {
    ...progress,
    result: usable ? scanned.result : null,
  }

  /**
   * One row of the file, built on demand. It carries the marks the pass found, so a row on
   * screen says exactly what the summary counted it as.
   */
  const reader = useMemo(
    () =>
      mapping === null || source === null
        ? null
        : rowReader({
            matrix: source.rows,
            mapping,
            context,
            merchants: merchantIndex,
            duplicates: scan.result?.duplicates,
            pairs: scan.result?.pairs,
          }),
    [mapping, source, context, merchantIndex, scan.result],
  )

  const rowAt = useCallback(
    (index: number): ParsedRow | null => reader?.at(index) ?? null,
    [reader],
  )

  const file: ImportFileInfo | null = useMemo(() => {
    if (source === null || meta === null) return null
    return {
      name: meta.name,
      size: meta.size,
      dialect: source.dialect,
      headers: source.headers,
      rowCount: source.rowCount,
      columnCount: source.columnCount,
      sample: source.rows.slice(0, SAMPLE_ROWS),
    }
  }, [source, meta])

  return {
    step,
    furthest,
    canGoTo,
    read,
    scan,
    file,
    draft,
    mapping,
    suggestedRoles,
    matrix: source?.rows ?? NO_MATRIX,
    rowAt,
    context,
    walletGroups,
    catalog,
    categories,
    fallbackCategory,
    // The same index the pass ran against, so step ③'s badges and the rows it shows can
    // never disagree about which merchant a spelling matched.
    merchantIndex,
    baseCurrency,
    templateId,
    actions: {
      openFile,
      cancelRead,
      setDialect,
      chooseTemplate: setTemplateId,
      updateMapping,
      goTo,
      next,
      back,
      reset,
    },
  }
}

export type CsvImport = ReturnType<typeof useCsvImport>
