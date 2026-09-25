import { readRow, rowFromFacts } from './csv/rows'
import { pairOf, settleTransfer, transferLookupOf } from './pairing'
import type { TxType } from '#/features/transactions/api/types'
import type { CurrencyCode } from '#/lib/currency'
import type {
  Mapping,
  ParsedRow,
  RowContext,
  RowFacts,
  RowIntent,
} from './types'

/**
 * A single row the user corrected in review. The patch is kept, not the corrected row: the
 * mapping behind every row can still change, and a correction has to survive that — so it
 * is re-applied to freshly derived facts rather than frozen into a row that is about to be
 * thrown away.
 */
export type RowPatch = {
  date?: string
  amountMinor?: number
  currency?: CurrencyCode
  type?: TxType
  walletId?: string
  category?: string
  subcategory?: string | null
  note?: string | null
  intent?: RowIntent
  /** The other wallet of a transfer with no partner in the file. */
  counterpartId?: string | null
  /** This row no longer pairs with the one the pass found — set on both sides at once. */
  unpaired?: true
}

/** The fields a pair was matched on: changing one on either side leaves two lone rows. */
const PAIR_FIELDS: ReadonlyArray<keyof RowPatch> = [
  'date',
  'amountMinor',
  'currency',
  'type',
  'walletId',
  'intent',
  'counterpartId',
]

export const breaksPair = (patch: RowPatch): boolean =>
  PAIR_FIELDS.some((field) => patch[field] !== undefined)

export const isEmptyPatch = (patch: RowPatch): boolean =>
  Object.keys(patch).length === 0

/**
 * A corrected value is a fact, not a guess: setting one clears the "we fell back to the
 * default" flags that would otherwise warn about a cell the user just answered.
 */
const patchFacts = (facts: RowFacts, patch: RowPatch): RowFacts => {
  const next = { ...facts }
  if (patch.date !== undefined) {
    next.date = patch.date
    next.dateCell = patch.date
  }
  if (patch.amountMinor !== undefined) {
    next.amountMinor = patch.amountMinor
    next.amountState = 'ok'
    next.amountCell = String(patch.amountMinor)
  }
  if (patch.currency !== undefined) {
    next.currency = patch.currency
    next.currencyCell = patch.currency
  }
  if (patch.type !== undefined) {
    next.type = patch.type
    next.typeDefaulted = false
  }
  if (patch.walletId !== undefined) {
    next.walletId = patch.walletId
    next.walletSkipped = false
  }
  if (patch.category !== undefined) {
    next.category = patch.category
    next.subcategory = patch.subcategory ?? null
    next.categoryDefaulted = false
  }
  if (patch.note !== undefined) next.note = patch.note
  if (patch.intent !== undefined) next.intent = patch.intent
  if (patch.counterpartId !== undefined) {
    next.counterpartId = patch.counterpartId
  }
  return next
}

/**
 * Re-read the row's own cells, lay the correction over them and run the rules again, so a
 * fixed row flips to ready the moment it is saved.
 *
 * Duplicate marks are carried across rather than recomputed: `markRow` only knows what a row
 * repeats from the rows checked before it, so re-deciding one edited row means re-running
 * the pass over ten thousand others. A transfer pair is carried the same way, unless the
 * patch says the pair is broken — then the row stands alone and names its other wallet.
 */
export const applyRowPatch = (
  row: ParsedRow,
  patch: RowPatch,
  mapping: Mapping,
  context: RowContext,
): ParsedRow => {
  if (isEmptyPatch(patch)) return row
  const facts = patchFacts(readRow(row.raw, row.index, mapping), patch)
  return settleTransfer(
    {
      ...rowFromFacts(facts, mapping, context),
      duplicateOf: row.duplicateOf,
      duplicateOfIndex: row.duplicateOfIndex,
      prediction: row.prediction,
    },
    patch.unpaired === true ? undefined : pairOf(row),
    transferLookupOf(mapping, context),
  )
}
