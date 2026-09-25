import { useCallback, useMemo, useState } from 'react'
import {
  applyRowPatch,
  breaksPair,
  isEmptyPatch,
} from '#/features/import/data/rowEdits'
import { isDuplicate, statusOf } from '#/features/import/data/review'
import { skippedAt, statusAt, transferAt } from '#/features/import/data/rowScan'
import type {
  CsvImport,
  ImportFileInfo,
} from '#/features/import/hooks/useCsvImport'
import type { RowPatch } from '#/features/import/data/rowEdits'
import type {
  ReviewCounts,
  ReviewFilter,
  RowStatus,
} from '#/features/import/data/review'
import type { ImportPlan } from '#/features/import/data/importCounts'
import type { RowScan } from '#/features/import/data/rowScan'
import type { ParsedRow } from '#/features/import/data/types'

/**
 * Step ④ as state — and the one place a user's row-level decisions live.
 *
 * A mapping change re-reads every row from the file, so an exclusion or a correction kept
 * *on* a row would vanish the moment the user stepped back and adjusted a column. They are
 * kept here instead, keyed by the file's own row index, and laid back over the rows as they
 * are built. A re-read of the file (a new dialect) is the one thing that invalidates them,
 * because the indices no longer point at the same lines.
 *
 * Nothing here holds the file. The counts, the order and the filters are read off the
 * pass's status bytes; a `ParsedRow` is built only for a row that reaches the screen, the
 * commit or the skipped-rows download.
 *
 * The two sides of a paired transfer are one decision: leaving either out leaves both out,
 * and correcting a field the pair was matched on turns both back into lone rows.
 */

export type RowOverride = {
  /** The user's own call on this row, which outranks the duplicate rule. */
  excluded?: boolean
  patch?: RowPatch
}

type Store = {
  owner: ImportFileInfo | null
  overrides: ReadonlyMap<number, RowOverride>
}

const EMPTY: ReadonlyMap<number, RowOverride> = new Map()

const NO_ROWS: number[] = []

const NO_PLAN: ImportPlan = { transactions: 0, transfers: 0 }

const NO_COUNTS: ReviewCounts = {
  total: 0,
  ok: 0,
  warning: 0,
  error: 0,
  duplicate: 0,
}

/** Rows kept built at once. A window is ~30; this holds a few screens of scrollback. */
const CACHE_LIMIT = 200

const withOverride = (
  overrides: ReadonlyMap<number, RowOverride>,
  index: number,
  patch: Partial<RowOverride>,
): ReadonlyMap<number, RowOverride> => {
  const next = new Map(overrides)
  next.set(index, { ...next.get(index), ...patch })
  return next
}

const withExclusion = (row: ParsedRow, excluded: boolean): ParsedRow =>
  row.excluded === excluded ? row : { ...row, excluded }

type Tally = {
  counts: ReviewCounts
  /**
   * File rows that will be written, in the order the table shows them — except that a
   * paired row's partner follows it at once, so no slice of this list splits a transfer.
   */
  committable: number[]
  /** What those rows become: ledger rows, and transfers counted once per pair. */
  plan: ImportPlan
  /** File rows that will not be — what the skipped-rows download quotes. */
  excluded: number[]
  excludedDuplicates: number
}

const EMPTY_TALLY: Tally = {
  counts: NO_COUNTS,
  committable: NO_ROWS,
  plan: NO_PLAN,
  excluded: NO_ROWS,
  excludedDuplicates: 0,
}

/** A corrected row outranks the pass; everything else is one byte. */
const statusFor = (
  scan: RowScan,
  corrected: ReadonlyMap<number, ParsedRow>,
  index: number,
): RowStatus => {
  const fixed = corrected.get(index)
  return fixed === undefined ? statusAt(scan, index) : statusOf(fixed)
}

/** The partner of a row whose pair still stands, or undefined. */
const partnerOf = (
  scan: RowScan,
  overrides: ReadonlyMap<number, RowOverride>,
  index: number,
): number | undefined =>
  overrides.get(index)?.patch?.unpaired === true
    ? undefined
    : scan.pairs.get(index)?.partner

/**
 * Why a row is out: a skip mapping, the duplicate rule, or the user — in that order, the
 * user's own call last because it outranks both.
 */
const excludedAlone = (
  scan: RowScan,
  corrected: ReadonlyMap<number, ParsedRow>,
  overrides: ReadonlyMap<number, RowOverride>,
  skipDuplicates: boolean,
  index: number,
): boolean => {
  const fixed = corrected.get(index)
  const repeats =
    fixed === undefined ? scan.duplicates.has(index) : isDuplicate(fixed)
  const own = overrides.get(index)?.excluded
  if (own !== undefined) return own
  if (repeats) return skipDuplicates
  return fixed === undefined ? skippedAt(scan, index) : fixed.excluded
}

/** A transfer is written whole or not at all, so either side being out takes both out. */
const excludedFor = (
  scan: RowScan,
  corrected: ReadonlyMap<number, ParsedRow>,
  overrides: ReadonlyMap<number, RowOverride>,
  skipDuplicates: boolean,
  index: number,
): boolean => {
  if (excludedAlone(scan, corrected, overrides, skipDuplicates, index)) {
    return true
  }
  const partner = partnerOf(scan, overrides, index)
  return (
    partner !== undefined &&
    excludedAlone(scan, corrected, overrides, skipDuplicates, partner)
  )
}

const isTransferRow = (
  scan: RowScan,
  corrected: ReadonlyMap<number, ParsedRow>,
  index: number,
): boolean => {
  const fixed = corrected.get(index)
  return fixed === undefined
    ? transferAt(scan, index)
    : fixed.intent === 'transfer'
}

/**
 * The whole file added up, from the pass's bytes plus the handful of rows the user touched.
 * It is integer work over a `Uint8Array` — the rows themselves are never built.
 */
const tally = (
  scan: RowScan,
  corrected: ReadonlyMap<number, ParsedRow>,
  overrides: ReadonlyMap<number, RowOverride>,
  skipDuplicates: boolean,
): Tally => {
  const counts: ReviewCounts = { ...NO_COUNTS, total: scan.total }
  const committable: number[] = []
  const excluded: number[] = []
  const placed = new Set<number>()
  const plan = { transactions: 0, transfers: 0 }
  let excludedDuplicates = 0

  const writable = (index: number): boolean =>
    statusFor(scan, corrected, index) !== 'error' &&
    !excludedFor(scan, corrected, overrides, skipDuplicates, index)

  const place = (index: number) => {
    committable.push(index)
    placed.add(index)
    if (!isTransferRow(scan, corrected, index)) plan.transactions += 1
    else if (partnerOf(scan, overrides, index) === undefined) {
      plan.transfers += 1
    }
  }

  for (const index of scan.order) {
    const status = statusFor(scan, corrected, index)
    counts[status] += 1
    if (excludedFor(scan, corrected, overrides, skipDuplicates, index)) {
      excluded.push(index)
      if (status === 'duplicate') excludedDuplicates += 1
    } else if (status !== 'error' && !placed.has(index)) {
      place(index)
      const partner = partnerOf(scan, overrides, index)
      if (partner !== undefined) {
        plan.transfers += 1
        if (writable(partner)) place(partner)
      }
    }
  }

  return { counts, committable, plan, excluded, excludedDuplicates }
}

export function useReviewRows(csv: CsvImport) {
  const [store, setStore] = useState<Store>({ owner: null, overrides: EMPTY })
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [filter, setFilter] = useState<ReviewFilter>('all')

  const scan = csv.scan.result
  const overrides = store.owner === csv.file ? store.overrides : EMPTY
  const { rowAt, mapping, context } = csv

  const write = useCallback(
    (next: ReadonlyMap<number, RowOverride>) =>
      setStore({ owner: csv.file, overrides: next }),
    [csv.file],
  )

  /**
   * The rows the user corrected, re-read through the *current* mapping — a patch is the
   * fields that changed, never a frozen row. There are only ever a handful.
   */
  const corrected = useMemo(() => {
    const fixed = new Map<number, ParsedRow>()
    if (mapping === null) return fixed
    for (const [index, override] of overrides) {
      const patch = override.patch
      if (patch === undefined || isEmptyPatch(patch)) continue
      const row = rowAt(index)
      if (row !== null)
        fixed.set(index, applyRowPatch(row, patch, mapping, context))
    }
    return fixed
  }, [overrides, rowAt, mapping, context])

  const summary = useMemo(
    () =>
      scan === null
        ? EMPTY_TALLY
        : tally(scan, corrected, overrides, skipDuplicates),
    [scan, corrected, overrides, skipDuplicates],
  )

  const statusOfRow = useCallback(
    (index: number): RowStatus =>
      scan === null ? 'error' : statusFor(scan, corrected, index),
    [scan, corrected],
  )

  const isExcluded = useCallback(
    (index: number): boolean =>
      scan !== null &&
      excludedFor(scan, corrected, overrides, skipDuplicates, index),
    [scan, corrected, overrides, skipDuplicates],
  )

  /** The file rows on screen, in the table's order, narrowed to the chosen filter. */
  const screen = useMemo(() => {
    const list: number[] = []
    let included = 0
    if (scan !== null) {
      for (const index of scan.order) {
        if (filter !== 'all' && statusOfRow(index) !== filter) continue
        list.push(index)
        if (!isExcluded(index)) included += 1
      }
    }
    return { list, included }
  }, [scan, filter, statusOfRow, isExcluded])

  const visible = screen.list

  /**
   * Built rows, kept for as long as they are near the window. Identity has to be stable or
   * `ReviewRow`'s `memo` stops biting and a one-row scroll re-renders the whole window.
   */
  const cache = useMemo(
    () => new Map<number, ParsedRow>(),
    [rowAt, corrected, isExcluded],
  )

  const rowFor = useCallback(
    (index: number): ParsedRow | null => {
      const held = cache.get(index)
      if (held !== undefined) {
        cache.delete(index)
        cache.set(index, held)
        return held
      }
      const base = corrected.get(index) ?? rowAt(index)
      if (base === null) return null
      const row = withExclusion(base, isExcluded(index))
      if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next()
        if (!oldest.done) cache.delete(oldest.value)
      }
      cache.set(index, row)
      return row
    },
    [cache, corrected, rowAt, isExcluded],
  )

  /** The row at a position in the filtered table — what the virtual window asks for. */
  const rowAtPosition = useCallback(
    (position: number): ParsedRow | null =>
      position < 0 || position >= visible.length
        ? null
        : rowFor(visible[position]),
    [visible, rowFor],
  )

  /** Build a named set of rows in one go — the skipped-rows download, and nothing else. */
  const rowsFor = useCallback(
    (indices: ReadonlyArray<number>): ParsedRow[] => {
      const rows: ParsedRow[] = []
      for (const index of indices) {
        const row = corrected.get(index) ?? rowAt(index)
        if (row !== null) rows.push(withExclusion(row, isExcluded(index)))
      }
      return rows
    },
    [corrected, rowAt, isExcluded],
  )

  /** One row's own call, laid on its partner too while the pair stands. */
  const excludeBoth = useCallback(
    (
      current: ReadonlyMap<number, RowOverride>,
      index: number,
      excluded: boolean,
    ): ReadonlyMap<number, RowOverride> => {
      const next = withOverride(current, index, { excluded })
      const partner =
        scan === null ? undefined : partnerOf(scan, current, index)
      return partner === undefined
        ? next
        : withOverride(next, partner, { excluded })
    },
    [scan],
  )

  const toggleRow = useCallback(
    (index: number, excluded: boolean) =>
      write(excludeBoth(overrides, index, excluded)),
    [overrides, write, excludeBoth],
  )

  /** The header checkbox is scoped to what is on screen, never to the whole file. */
  const setVisibleExcluded = useCallback(
    (excluded: boolean) => {
      let next = overrides
      for (const index of visible) {
        if (excluded && statusOfRow(index) === 'error') continue
        next = excludeBoth(next, index, excluded)
      }
      write(next)
    },
    [overrides, visible, statusOfRow, write, excludeBoth],
  )

  const editRow = useCallback(
    (index: number, patch: RowPatch) => {
      const partner =
        scan === null ? undefined : partnerOf(scan, overrides, index)
      const unpair = partner !== undefined && breaksPair(patch)
      let next = withOverride(overrides, index, {
        patch: {
          ...overrides.get(index)?.patch,
          ...patch,
          ...(unpair ? { unpaired: true as const } : {}),
        },
      })
      if (unpair) {
        next = withOverride(next, partner, {
          patch: { ...overrides.get(partner)?.patch, unpaired: true },
        })
      }
      write(next)
    },
    [scan, overrides, write],
  )

  const patchFor = useCallback(
    (index: number) => overrides.get(index)?.patch ?? null,
    [overrides],
  )

  const visibleIncluded = screen.included

  /** Checked when every row on screen is in; indeterminate while only some are. */
  const headerChecked: boolean | 'indeterminate' =
    visible.length > 0 && visibleIncluded === visible.length
      ? true
      : visibleIncluded === 0
        ? false
        : 'indeterminate'

  return {
    counts: summary.counts,
    committable: summary.committable,
    plan: summary.plan,
    excluded: summary.excluded,
    excludedDuplicates: summary.excludedDuplicates,
    visible,
    rowAt: rowAtPosition,
    rowsFor,
    filter,
    setFilter,
    skipDuplicates,
    setSkipDuplicates,
    toggleRow,
    setVisibleExcluded,
    editRow,
    patchFor,
    headerChecked,
  }
}

export type ReviewRows = ReturnType<typeof useReviewRows>
