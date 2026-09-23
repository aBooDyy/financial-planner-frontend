import { isAmountLike } from './amounts'
import { isDateLike } from './dates'

/**
 * Text → the file's shape: which character separates fields, which quotes them, how many
 * preamble lines sit above the header, and whether `1.234,56` means twelve hundred or one
 * point two. Every answer here is a proposal the user can correct in Adjust.
 */

/** Tried in this order; a tie goes to the earlier candidate. */
export const DELIMITERS: ReadonlyArray<string> = [',', ';', '\t', '|']

const SAMPLE_LINES = 20

/** A delimiter must show the same count on this share of the sampled lines. */
const CONSISTENCY = 0.8

/** How far into the file a header row may hide behind preamble. */
const HEADER_SCAN = 20

/**
 * Split text into lines, ignoring newlines inside quoted fields — a description containing
 * a line break must not look like two rows to the delimiter counter.
 */
export const sampleLines = (
  text: string,
  quote: string,
  limit: number = SAMPLE_LINES,
): string[] => {
  const lines: string[] = []
  let current = ''
  let quoted = false
  for (const char of text) {
    if (char === quote) {
      quoted = !quoted
      current += char
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (current.trim() !== '') lines.push(current)
      current = ''
      if (lines.length >= limit) return lines
    } else {
      current += char
    }
  }
  if (current.trim() !== '' && lines.length < limit) lines.push(current)
  return lines
}

const countOutsideQuotes = (
  line: string,
  needle: string,
  quote: string,
): number => {
  let count = 0
  let quoted = false
  for (const char of line) {
    if (char === quote) quoted = !quoted
    else if (!quoted && char === needle) count += 1
  }
  return count
}

const modeOf = (values: ReadonlyArray<number>): number => {
  const tally = new Map<number, number>()
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1)
  let best = 0
  let bestCount = 0
  for (const [value, count] of tally) {
    if (count > bestCount || (count === bestCount && value > best)) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * The winner is the candidate with the highest count that is *consistent* across the sample.
 * Consistency is what separates a real delimiter from a comma that happens to appear in a
 * few descriptions. Agreement is measured over the lines where the candidate appears at all,
 * because a statement's preamble lines contain no delimiter and would otherwise veto it.
 */
export const detectDelimiter = (
  lines: ReadonlyArray<string>,
  quote = '"',
): string => {
  if (lines.length === 0) return DELIMITERS[0]
  let winner = DELIMITERS[0]
  let winnerCount = 0
  for (const candidate of DELIMITERS) {
    const counts = lines
      .map((line) => countOutsideQuotes(line, candidate, quote))
      .filter((count) => count > 0)
    if (counts.length < 2) continue
    const modal = modeOf(counts)
    const agreeing = counts.filter((count) => count === modal).length
    if (agreeing / counts.length < CONSISTENCY) continue
    if (modal > winnerCount) {
      winner = candidate
      winnerCount = modal
    }
  }
  return winner
}

const DOUBLE_WRAPPED = /^".*"$/s
const SINGLE_WRAPPED = /^'.*'$/s

/** `"` unless single quotes wrap the clear majority of the wrapped cells. */
export const detectQuote = (lines: ReadonlyArray<string>): string => {
  let doubles = 0
  let singles = 0
  for (const line of lines) {
    for (const cell of line.split(/[,;\t|]/)) {
      const trimmed = cell.trim()
      if (trimmed.length < 2) continue
      if (DOUBLE_WRAPPED.test(trimmed)) doubles += 1
      else if (SINGLE_WRAPPED.test(trimmed)) singles += 1
    }
  }
  const wrapped = doubles + singles
  return wrapped > 0 && singles / wrapped >= CONSISTENCY ? "'" : '"'
}

const isHeaderCell = (cell: string): boolean => {
  const value = cell.trim()
  return value !== '' && !isAmountLike(value) && !isDateLike(value)
}

/**
 * The header is the first full-width row that reads as labels. Rows above it are preamble
 * (account holder, statement period, a blank line) and become `skipRows`.
 */
export const detectHeader = (
  matrix: ReadonlyArray<ReadonlyArray<string>>,
): { skipRows: number; hasHeader: boolean } => {
  if (matrix.length === 0) return { skipRows: 0, hasHeader: false }
  const width = modeOf(matrix.map((row) => row.length))
  const limit = Math.min(matrix.length, HEADER_SCAN)
  for (let index = 0; index < limit; index += 1) {
    const row = matrix[index]
    if (row.length !== width || row.length < 2) continue
    if (row.every(isHeaderCell)) return { skipRows: index, hasHeader: true }
  }
  return { skipRows: 0, hasHeader: false }
}

/**
 * Which separator is the decimal point, voted on by the most numeric column. A value with
 * both separators is decided by whichever comes last; a lone separator followed by exactly
 * three digits abstains, because `1.234` is a thousand in Berlin and 1.234 dinars in Kuwait.
 */
const decimalVote = (value: string): '.' | ',' | null => {
  const digits = value.replace(/[^\d.,]/g, '')
  const lastDot = digits.lastIndexOf('.')
  const lastComma = digits.lastIndexOf(',')
  if (lastDot < 0 && lastComma < 0) return null
  if (lastDot >= 0 && lastComma >= 0) return lastDot > lastComma ? '.' : ','
  const separator: '.' | ',' = lastDot >= 0 ? '.' : ','
  const position = Math.max(lastDot, lastComma)
  if (digits.split(separator).length > 2) {
    return separator === '.' ? ',' : '.'
  }
  return digits.length - position - 1 === 3 ? null : separator
}

const amountColumn = (
  rows: ReadonlyArray<ReadonlyArray<string>>,
  width: number,
): number => {
  let best = -1
  let bestScore = 0
  for (let column = 0; column < width; column += 1) {
    let score = 0
    for (const row of rows) {
      const cell = row[column] ?? ''
      if (cell.trim() !== '' && !isDateLike(cell) && isAmountLike(cell)) {
        score += 1
      }
    }
    if (score > bestScore) {
      best = column
      bestScore = score
    }
  }
  return best
}

export const detectDecimal = (
  rows: ReadonlyArray<ReadonlyArray<string>>,
  delimiter: string,
): '.' | ',' => {
  const fallback: '.' | ',' = delimiter === ';' ? ',' : '.'
  const width = modeOf(rows.map((row) => row.length))
  const column = amountColumn(rows, width)
  if (column < 0) return fallback
  let dots = 0
  let commas = 0
  for (const row of rows) {
    const vote = decimalVote(row[column] ?? '')
    if (vote === '.') dots += 1
    else if (vote === ',') commas += 1
  }
  if (dots === commas) return fallback
  return dots > commas ? '.' : ','
}
