import { decimalsFor } from '#/lib/currency'
import { withReference } from '../reference'
import { matchCurrency, matchType, normalizeKey } from '../matching'
import {
  ROW_ISSUES,
  hasErrors,
  lookup,
  pendingCategoryId,
  roleColumn,
} from '../types'
import { validateRow } from '../validate'
import { parseAmountCell } from './amounts'
import { parseDateCell } from './dates'
import { CSV_FILE_ERRORS, CsvFileError } from './errors'
import type { TxType } from '#/features/transactions/api/types'
import type { TransactionDraft } from '#/features/transactions/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import type {
  AmountState,
  Mapping,
  ParsedRow,
  RowContext,
  RowFacts,
  RowIntent,
  RowIssue,
} from '../types'

/**
 * Raw cells + a mapping → the rows the review step shows. Everything a row says is read
 * here; whether that makes it committable is `validate.ts`'s call, and merchant prediction
 * is a later pass over the result.
 */

const other = (type: TxType): TxType => (type === 'spend' ? 'income' : 'spend')

const cellAt = (cells: ReadonlyArray<string>, column: number): string =>
  column < 0 ? '' : (cells[column] ?? '')

/**
 * One amount cell in the mapping's unit. `parseAmountCell` scales major units by the
 * currency's decimals, so a file that already counts minor units is that same parse divided
 * back down — the cleanup (symbols, signs, separators, Arabic digits) is not worth a second
 * implementation.
 */
const readAmount = (
  cell: string,
  mapping: Mapping,
  currency: CurrencyCode,
): { minor: number; negative: boolean } | null => {
  const parsed = parseAmountCell(cell, mapping.dialect.decimal, currency)
  if (parsed === null) return null
  if (mapping.amountUnit === 'major') return parsed
  const scale = 10 ** decimalsFor(currency)
  return { minor: Math.round(parsed.minor / scale), negative: parsed.negative }
}

type AmountRead = {
  minor: number | null
  cell: string
  state: AmountState
  /** Null when direction comes from elsewhere (the type column, or the default). */
  type: TxType | null
}

const readSigned = (
  cells: ReadonlyArray<string>,
  mapping: Mapping,
  currency: CurrencyCode,
  column: number,
  negativeMeans: TxType,
): AmountRead => {
  const cell = cellAt(cells, column)
  if (cell.trim() === '')
    return { minor: null, cell, state: 'missing', type: null }
  const parsed = readAmount(cell, mapping, currency)
  if (parsed === null)
    return { minor: null, cell, state: 'unreadable', type: null }
  return {
    minor: parsed.minor,
    cell,
    state: 'ok',
    type: parsed.negative ? negativeMeans : other(negativeMeans),
  }
}

const readSplit = (
  cells: ReadonlyArray<string>,
  mapping: Mapping,
  currency: CurrencyCode,
  outColumn: number,
  inColumn: number,
): AmountRead => {
  const outCell = cellAt(cells, outColumn)
  const inCell = cellAt(cells, inColumn)
  const hasOut = outCell.trim() !== ''
  const hasIn = inCell.trim() !== ''
  if (hasOut && hasIn) {
    return {
      minor: null,
      cell: `${outCell.trim()} / ${inCell.trim()}`,
      state: 'ambiguous',
      type: null,
    }
  }
  if (!hasOut && !hasIn)
    return { minor: null, cell: '', state: 'missing', type: null }
  const cell = hasOut ? outCell : inCell
  const parsed = readAmount(cell, mapping, currency)
  if (parsed === null)
    return { minor: null, cell, state: 'unreadable', type: null }
  return {
    minor: parsed.minor,
    cell,
    state: 'ok',
    type: hasOut ? 'spend' : 'income',
  }
}

const readTyped = (
  cells: ReadonlyArray<string>,
  mapping: Mapping,
  currency: CurrencyCode,
  column: number,
): AmountRead => {
  const cell = cellAt(cells, column)
  if (cell.trim() === '')
    return { minor: null, cell, state: 'missing', type: null }
  const parsed = readAmount(cell, mapping, currency)
  if (parsed === null)
    return { minor: null, cell, state: 'unreadable', type: null }
  return { minor: parsed.minor, cell, state: 'ok', type: null }
}

const readAmountCells = (
  cells: ReadonlyArray<string>,
  mapping: Mapping,
  currency: CurrencyCode | null,
): AmountRead => {
  // The currency gate runs first on purpose: an unlisted code makes every amount unreadable,
  // and reporting the amount cell would name the wrong problem.
  if (currency === null)
    return { minor: null, cell: '', state: 'skipped', type: null }
  const mode = mapping.amount
  if (mode.kind === 'split') {
    return readSplit(cells, mapping, currency, mode.outColumn, mode.inColumn)
  }
  if (mode.kind === 'typed')
    return readTyped(cells, mapping, currency, mode.column)
  return readSigned(cells, mapping, currency, mode.column, mode.negativeMeans)
}

/**
 * Types and currencies resolve from the file's own words when no alias binds them: they are
 * a closed vocabulary with no user-owned entity behind them, so there is nothing to ask
 * about. Wallets, categories and merchants are the user's own records and are bound only by
 * an alias — auto-filing money into an account nobody chose is not a guess worth making.
 */
const readType = (
  cells: ReadonlyArray<string>,
  mapping: Mapping,
  amount: AmountRead,
): { type: TxType; defaulted: boolean } => {
  if (amount.type !== null) return { type: amount.type, defaulted: false }
  if (mapping.amount.kind !== 'typed') {
    return { type: mapping.defaults.type, defaulted: false }
  }
  const cell = cellAt(cells, mapping.amount.typeColumn).trim()
  if (cell === '') return { type: mapping.defaults.type, defaulted: true }
  const bound =
    lookup(mapping.aliases.types, normalizeKey(cell)) ?? matchType(cell)
  return bound === null
    ? { type: mapping.defaults.type, defaulted: true }
    : { type: bound, defaulted: false }
}

const readCurrency = (
  cells: ReadonlyArray<string>,
  mapping: Mapping,
): { currency: CurrencyCode | null; cell: string } => {
  const cell = cellAt(cells, roleColumn(mapping.roles, 'currency'))
  if (cell.trim() === '') return { currency: mapping.defaults.currency, cell }
  const alias = lookup(mapping.aliases.currencies, normalizeKey(cell))
  return { currency: alias ?? matchCurrency(cell), cell }
}

const readWallet = (
  cells: ReadonlyArray<string>,
  mapping: Mapping,
): { walletId: string | null; skipped: boolean } => {
  const cell = cellAt(cells, roleColumn(mapping.roles, 'wallet')).trim()
  const target =
    cell === ''
      ? undefined
      : lookup(mapping.aliases.wallets, normalizeKey(cell))
  if (target?.kind === 'skip') return { walletId: null, skipped: true }
  if (target) return { walletId: target.walletId, skipped: false }
  return { walletId: mapping.defaults.walletId, skipped: false }
}

type CategoryRead = {
  categoryId: string
  defaulted: boolean
  intent: RowIntent
}

const readCategory = (
  cells: ReadonlyArray<string>,
  mapping: Mapping,
  type: TxType,
): CategoryRead => {
  const fallback = {
    categoryId: mapping.defaults.categoryIds[type],
    intent: 'cashflow' as const,
  }
  const cell = cellAt(cells, roleColumn(mapping.roles, 'category')).trim()
  const subCell = cellAt(cells, roleColumn(mapping.roles, 'subcategory')).trim()
  if (cell === '') return { ...fallback, defaulted: true }

  const aliases = mapping.aliases.categories
  const combined =
    subCell === ''
      ? undefined
      : lookup(aliases, normalizeKey(`${cell} ${subCell}`))
  const target = combined ?? lookup(aliases, normalizeKey(cell))
  // "Skip these rows" on a category means file them under the default, deliberately — so it
  // is not reported as a guess.
  if (target === undefined) return { ...fallback, defaulted: true }
  if (target.kind === 'skip') return { ...fallback, defaulted: false }
  // A movement files under no category; the default rides along so a row turned back into
  // spending in review still has one to show.
  if (target.kind === 'transfer' || target.kind === 'adjustment') {
    return { ...fallback, defaulted: false, intent: target.kind }
  }
  return {
    categoryId:
      target.kind === 'create' ? pendingCategoryId(target) : target.categoryId,
    defaulted: false,
    intent: 'cashflow',
  }
}

const readMerchant = (
  cells: ReadonlyArray<string>,
  mapping: Mapping,
): { merchantId: string | null; raw: string | null } => {
  const column = roleColumn(mapping.roles, 'merchant')
  if (column < 0) return { merchantId: null, raw: null }
  const cell = cellAt(cells, column).trim()
  if (cell === '') return { merchantId: null, raw: null }
  const target = lookup(mapping.aliases.merchants, normalizeKey(cell))
  return {
    merchantId:
      target !== undefined && target.kind !== 'skip' ? target.merchantId : null,
    raw: cell,
  }
}

export const readRow = (
  cells: ReadonlyArray<string>,
  index: number,
  mapping: Mapping,
): RowFacts => {
  const dateCell = cellAt(cells, roleColumn(mapping.roles, 'date'))
  const date =
    mapping.dateFormat === null
      ? null
      : parseDateCell(dateCell, mapping.dateFormat)

  const { currency, cell: currencyCell } = readCurrency(cells, mapping)
  const amount = readAmountCells(cells, mapping, currency)
  const { type, defaulted: typeDefaulted } = readType(cells, mapping, amount)
  const { walletId, skipped } = readWallet(cells, mapping)
  const category = readCategory(cells, mapping, type)
  const merchant = readMerchant(cells, mapping)

  const reference =
    cellAt(cells, roleColumn(mapping.roles, 'reference')).trim() || null
  const noteCell = cellAt(cells, roleColumn(mapping.roles, 'note')).trim()
  // An unbound description is worth keeping: it is all the row says about who was paid.
  const narrative =
    noteCell || (merchant.merchantId === null ? (merchant.raw ?? '') : '')

  return {
    index,
    // `readCsv` drops blank lines, so this is exact for ordinary files and approximate for
    // rows carrying a newline inside a quoted field.
    line:
      mapping.dialect.skipRows +
      (mapping.dialect.hasHeader ? 1 : 0) +
      index +
      1,
    raw: [...cells],
    date,
    dateCell,
    amountMinor: amount.minor,
    amountCell: amount.cell,
    amountState: amount.state,
    type,
    typeDefaulted,
    currency,
    currencyCell,
    walletId,
    walletSkipped: skipped,
    categoryId: category.categoryId,
    categoryDefaulted: category.defaulted,
    intent: category.intent,
    counterpartId: null,
    merchantId: merchant.merchantId,
    merchantRaw: merchant.raw,
    note: withReference(narrative === '' ? null : narrative, reference),
    reference,
    ragged: cells.length < mapping.roles.length,
  }
}

const draftFrom = (
  facts: RowFacts,
  issues: ReadonlyArray<RowIssue>,
): TransactionDraft | null => {
  // A category of the other direction is fixed in the row editor, which opens on the draft;
  // `isCommittable` still holds the row back on the error.
  const unreadable = issues.filter(
    (issue) => issue.code !== ROW_ISSUES.categoryTypeMismatch,
  )
  if (hasErrors(unreadable)) return null
  if (
    facts.date === null ||
    facts.currency === null ||
    facts.amountMinor === null ||
    facts.walletId === null
  ) {
    return null
  }
  return {
    type: facts.type,
    amount: facts.amountMinor,
    currency: facts.currency,
    categoryId: facts.categoryId,
    walletId: facts.walletId,
    goalId: null,
    merchantId: facts.merchantId,
    date: facts.date,
    note: facts.note,
  }
}

/**
 * Facts → the row the review step shows. Split out of `buildRow` because the single-row
 * editor patches facts a user corrected and needs the same rules run over them.
 */
export const rowFromFacts = (
  facts: RowFacts,
  mapping: Mapping,
  context: RowContext,
): ParsedRow => {
  const issues = validateRow(facts, mapping, context)
  const draft = draftFrom(facts, issues)
  return {
    index: facts.index,
    line: facts.line,
    raw: facts.raw,
    draft,
    intent: facts.intent,
    transfer:
      facts.intent === 'transfer'
        ? {
            pairIndex: null,
            counterpartId: facts.counterpartId,
            guessed: false,
          }
        : null,
    issues,
    reference: facts.reference,
    excluded: facts.walletSkipped,
    prediction: null,
  }
}

export const buildRow = (
  cells: ReadonlyArray<string>,
  index: number,
  mapping: Mapping,
  context: RowContext,
): ParsedRow => rowFromFacts(readRow(cells, index, mapping), mapping, context)

export const buildRows = (
  matrix: ReadonlyArray<ReadonlyArray<string>>,
  mapping: Mapping,
  context: RowContext,
): ParsedRow[] =>
  matrix.map((cells, index) => buildRow(cells, index, mapping, context))

export type BuildRowsOptions = {
  chunkSize?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

/** Rows per slice. Sized so a slice stays well inside one frame on a mid-range phone. */
const CHUNK = 2000

const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

/**
 * The same build, in slices. A 50 000-row file is roughly two tenths of a second of parsing;
 * doing it in one go blocks the step's own progress bar from ever painting.
 */
export const buildRowsAsync = async (
  matrix: ReadonlyArray<ReadonlyArray<string>>,
  mapping: Mapping,
  context: RowContext,
  options: BuildRowsOptions = {},
): Promise<ParsedRow[]> => {
  const chunkSize = options.chunkSize ?? CHUNK
  const rows: ParsedRow[] = []
  for (let start = 0; start < matrix.length; start += chunkSize) {
    if (options.signal?.aborted)
      throw new CsvFileError(CSV_FILE_ERRORS.cancelled)
    const end = Math.min(start + chunkSize, matrix.length)
    for (let index = start; index < end; index += 1) {
      rows.push(buildRow(matrix[index], index, mapping, context))
    }
    options.onProgress?.(rows.length, matrix.length)
    if (end < matrix.length) await yieldToEventLoop()
  }
  return rows
}
