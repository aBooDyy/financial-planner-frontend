import { buildRow } from './csv/rows'
import { CSV_FILE_ERRORS, CsvFileError } from './csv/errors'
import { emptySeen, markRow, withDuplicate } from './dedupe'
import { merchantLookup, predictRow } from './predict'
import { RANKED_STATUS, STATUS_RANK, statusOf } from './review'
import type { MerchantIndex } from '#/features/merchants/data/matching'
import type { DedupeIndex, DuplicateMark, SeenRows } from './dedupe'
import type { MerchantLookup } from './predict'
import type { ReviewCounts, RowStatus } from './review'
import type { Mapping, ParsedRow, RowContext, RowIssueCode } from './types'

/**
 * One streaming pass over the file, and the lazy reader that follows it.
 *
 * A `ParsedRow` costs roughly a kilobyte; a file has tens of thousands of rows and a screen
 * holds thirty. So the pass keeps **only what a whole-file question needs** — a status byte
 * per row, the order the table shows them in, and a mark for the few rows that repeat
 * something — and every row the user actually looks at is built from the raw matrix on the
 * way to the screen.
 *
 * The pass runs in the plan's order: read the row → predict its merchant → check it for
 * duplicates. That order is load-bearing, because binding a merchant changes a row's
 * fingerprint.
 */

/** How many rows each issue touches — the whole-file warning line under step ②'s table. */
export type IssueCount = {
  code: RowIssueCode
  level: 'warning' | 'error'
  count: number
}

export type RowScan = {
  total: number
  /** Per row: the status rank in the low two bits, then "left out by a skip mapping". */
  flags: Uint8Array
  /** File rows in the order the table shows them: attention first, then the file's own. */
  order: Int32Array
  /** Only the rows that repeat something — a statement repeats a handful, not itself. */
  duplicates: ReadonlyMap<number, DuplicateMark>
  /** The ledger rows those marks point at, deduped: what the duplicate ⓘ has to name. */
  duplicateIds: string[]
  counts: ReviewCounts
  issues: ReadonlyArray<IssueCount>
}

export type ScanInput = {
  matrix: ReadonlyArray<ReadonlyArray<string>>
  mapping: Mapping
  context: RowContext
  merchants: MerchantIndex
  ledger: DedupeIndex
}

export type ScanOptions = {
  chunkSize?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

const SKIPPED = 0b100

export const statusAt = (scan: RowScan, index: number): RowStatus =>
  RANKED_STATUS[scan.flags[index] & 0b11]

/** True when a wallet alias said "skip these rows" — the row leaves silently, as asked. */
export const skippedAt = (scan: RowScan, index: number): boolean =>
  (scan.flags[index] & SKIPPED) !== 0

export const EMPTY_MARKS: ReadonlyMap<number, DuplicateMark> = new Map()

// --- The pass -------------------------------------------------------------------------

type Pass = {
  flags: Uint8Array
  duplicates: Map<number, DuplicateMark>
  ids: Set<string>
  counts: ReviewCounts
  issues: Map<RowIssueCode, IssueCount>
  seen: SeenRows
  merchants: MerchantLookup
}

const startPass = (input: ScanInput): Pass => ({
  flags: new Uint8Array(input.matrix.length),
  duplicates: new Map(),
  ids: new Set(),
  counts: {
    total: input.matrix.length,
    ok: 0,
    warning: 0,
    error: 0,
    duplicate: 0,
  },
  issues: new Map(),
  seen: emptySeen(),
  merchants: merchantLookup(input.merchants),
})

const countIssues = (pass: Pass, row: ParsedRow): void => {
  const counted = new Set<RowIssueCode>()
  for (const issue of row.issues) {
    if (counted.has(issue.code)) continue
    counted.add(issue.code)
    const entry = pass.issues.get(issue.code)
    if (entry) entry.count += 1
    else
      pass.issues.set(issue.code, {
        code: issue.code,
        level: issue.level,
        count: 1,
      })
  }
}

const scanInto = (
  pass: Pass,
  input: ScanInput,
  start: number,
  end: number,
): void => {
  const { matrix, mapping, context, ledger } = input
  for (let index = start; index < end; index += 1) {
    const row = predictRow(
      buildRow(matrix[index], index, mapping, context),
      mapping,
      pass.merchants,
    )
    const mark = markRow(row, ledger, pass.seen, mapping.dedupe)
    const status: RowStatus = mark === null ? statusOf(row) : 'duplicate'
    if (mark !== null) {
      pass.duplicates.set(index, mark)
      if (mark.ledgerId !== null) pass.ids.add(mark.ledgerId)
    }
    pass.flags[index] = STATUS_RANK[status] | (row.excluded ? SKIPPED : 0)
    pass.counts[status] += 1
    countIssues(pass, row)
  }
}

/** The table's order, as a counting sort over the four ranks — stable by construction. */
const orderOf = (flags: Uint8Array, counts: ReviewCounts): Int32Array => {
  const order = new Int32Array(flags.length)
  const at = [0, 0, 0, 0]
  let running = 0
  for (let rank = 0; rank < RANKED_STATUS.length; rank += 1) {
    at[rank] = running
    running += counts[RANKED_STATUS[rank]]
  }
  for (let index = 0; index < flags.length; index += 1) {
    const rank = flags[index] & 0b11
    order[at[rank]] = index
    at[rank] += 1
  }
  return order
}

const finish = (pass: Pass): RowScan => ({
  total: pass.flags.length,
  flags: pass.flags,
  order: orderOf(pass.flags, pass.counts),
  duplicates: pass.duplicates,
  duplicateIds: [...pass.ids].sort(),
  counts: pass.counts,
  issues: [...pass.issues.values()].sort(
    (a, b) =>
      Number(b.level === 'error') - Number(a.level === 'error') ||
      b.count - a.count,
  ),
})

/** Rows per slice. Sized so a slice stays well inside one frame on a mid-range phone. */
const CHUNK = 2000

const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

/**
 * The pass as the wizard runs it: sliced, so a long file cannot block the progress bar that
 * is reporting it, and abortable, so a mapping change does not leave two passes racing.
 */
export const scanRows = async (
  input: ScanInput,
  options: ScanOptions = {},
): Promise<RowScan> => {
  const chunkSize = options.chunkSize ?? CHUNK
  const total = input.matrix.length
  const pass = startPass(input)
  for (let start = 0; start < total; start += chunkSize) {
    if (options.signal?.aborted)
      throw new CsvFileError(CSV_FILE_ERRORS.cancelled)
    const end = Math.min(start + chunkSize, total)
    scanInto(pass, input, start, end)
    options.onProgress?.(end, total)
    if (end < total) await yieldToEventLoop()
  }
  options.onProgress?.(total, total)
  return finish(pass)
}

/** The same pass in one go, for the pure tests and the component fixtures. */
export const scanRowsSync = (input: ScanInput): RowScan => {
  const pass = startPass(input)
  scanInto(pass, input, 0, input.matrix.length)
  return finish(pass)
}

// --- Reading one row again ------------------------------------------------------------

export type RowReaderInput = {
  matrix: ReadonlyArray<ReadonlyArray<string>>
  mapping: Mapping
  context: RowContext
  merchants: MerchantIndex
  /** The marks the pass found. Without them a row cannot know what it repeats. */
  duplicates?: ReadonlyMap<number, DuplicateMark>
}

export type RowReader = {
  /** Build one row of the file, exactly as the pass saw it. */
  at: (index: number) => ParsedRow
}

const NO_CELLS: ReadonlyArray<string> = []

/**
 * The only place a `ParsedRow` is made once the pass is over. The merchant matcher is held
 * across calls, so a window of rows sharing a counterparty scores it once.
 */
export const rowReader = (input: RowReaderInput): RowReader => {
  const merchants = merchantLookup(input.merchants)
  const duplicates = input.duplicates ?? EMPTY_MARKS
  return {
    at: (index) =>
      withDuplicate(
        predictRow(
          buildRow(
            input.matrix[index] ?? NO_CELLS,
            index,
            input.mapping,
            input.context,
          ),
          input.mapping,
          merchants,
        ),
        duplicates.get(index),
      ),
  }
}
