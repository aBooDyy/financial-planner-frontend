import Papa from 'papaparse'
import { assertFileSize, assertRowCount } from './caps'
import { decodeCsvBytes } from './encoding'
import { CSV_FILE_ERRORS, CsvFileError } from './errors'
import {
  detectDecimal,
  detectDelimiter,
  detectHeader,
  detectQuote,
  sampleLines,
} from './dialect'
import type { ImportLimits } from './caps'
import type { Dialect } from '../types'

/**
 * The whole read, as one pure function over bytes: decode, detect, tokenise, cut the
 * preamble off. It lives outside `worker.ts` so the risky part of the feature can be tested
 * without a worker at all; the worker is the thin thing that streams its output.
 */

export const PROGRESS_EVERY_ROWS = 2000

/** Enough for the ~20 lines detection samples, without scanning a 10 MB string twice. */
const HEAD_BYTES = 64 * 1024

/** Preamble + header allowance on top of the row cap, so the abort fires late, not early. */
const NON_DATA_ALLOWANCE = 64

export type CsvReadResult = {
  dialect: Dialect
  /** Empty when the file has no header row. */
  headers: string[]
  /** Data rows only, cells verbatim — the review step quotes the offending cell. */
  rows: string[][]
  rowCount: number
  columnCount: number
}

export type CsvReadOptions = {
  limits: ImportLimits
  /** Whatever the user corrected in Adjust, or a template restored. */
  overrides?: Partial<Dialect>
  onProgress?: (rows: number) => void
}

const tokenise = (
  text: string,
  delimiter: string,
  quote: string,
  limits: ImportLimits,
  onProgress?: (rows: number) => void,
): string[][] => {
  const matrix: string[][] = []
  const ceiling = limits.maxRows + NON_DATA_ALLOWANCE
  Papa.parse<string[]>(text, {
    delimiter,
    quoteChar: quote,
    escapeChar: quote,
    skipEmptyLines: 'greedy',
    step: (result, parser) => {
      matrix.push(result.data)
      if (matrix.length % PROGRESS_EVERY_ROWS === 0) onProgress?.(matrix.length)
      if (matrix.length > ceiling) parser.abort()
    },
  })
  // Reached only by the abort above: the cap is enforced exactly once rows are known.
  if (matrix.length > ceiling) {
    throw new CsvFileError(CSV_FILE_ERRORS.tooManyRows, String(matrix.length))
  }
  return matrix
}

const widestRow = (rows: ReadonlyArray<ReadonlyArray<string>>): number =>
  rows.reduce((widest, row) => Math.max(widest, row.length), 0)

export const readCsv = (
  bytes: Uint8Array,
  options: CsvReadOptions,
): CsvReadResult => {
  const { limits, overrides, onProgress } = options
  assertFileSize(bytes.byteLength, limits)

  const { encoding, text } = decodeCsvBytes(bytes, overrides?.encoding)
  if (text.trim() === '') throw new CsvFileError(CSV_FILE_ERRORS.empty)

  const head = text.slice(0, HEAD_BYTES)
  const quote = overrides?.quote ?? detectQuote(sampleLines(head, '"'))
  const delimiter =
    overrides?.delimiter ?? detectDelimiter(sampleLines(head, quote), quote)

  const matrix = tokenise(text, delimiter, quote, limits, onProgress)
  if (matrix.length === 0) throw new CsvFileError(CSV_FILE_ERRORS.empty)

  const detected = detectHeader(matrix)
  const skipRows = overrides?.skipRows ?? detected.skipRows
  const hasHeader = overrides?.hasHeader ?? detected.hasHeader
  const headers = hasHeader
    ? (matrix[skipRows] ?? []).map((cell) => cell.trim())
    : []
  const rows = matrix.slice(skipRows + (hasHeader ? 1 : 0))
  assertRowCount(rows.length, limits)

  const columnCount = Math.max(headers.length, widestRow(rows))
  if (columnCount < 2) throw new CsvFileError(CSV_FILE_ERRORS.singleColumn)

  return {
    dialect: {
      delimiter,
      quote,
      encoding,
      decimal: overrides?.decimal ?? detectDecimal(rows, delimiter),
      skipRows,
      hasHeader,
    },
    headers,
    rows,
    rowCount: rows.length,
    columnCount,
  }
}
