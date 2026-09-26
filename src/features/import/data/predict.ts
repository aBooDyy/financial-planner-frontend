import { AUTO_MATCH_SCORE } from '#/features/merchants/data/matching'
import {
  matchSuggestion,
  predictionFor,
} from '#/features/merchants/hooks/useMerchantMatch'
import { fingerprintOf } from './dedupe'
import { normalizeKey } from './matching'
import { ROW_ISSUES, lookup, roleColumn } from './types'
import type { MerchantIndex } from '#/features/merchants/data/matching'
import type { LocalMerchant } from '#/db/types'
import type { TxType } from '#/features/transactions/api/types'
import type { Mapping, ParsedRow } from './types'

/**
 * What a merchant already teaches us about a row. A description that resolves to a known
 * merchant arrives at review already categorised — silently when that merchant's
 * `auto_categorize` is on, and as a visible suggestion when it is not.
 *
 * The matcher and the `auto_categorize` rule both live in the merchants slice; this is only
 * what one row makes of them.
 */

/**
 * The merchant side of the index, read per distinct spelling rather than per row: a
 * statement repeats the same few dozen, and the scored matcher is the expensive half.
 */
export type MerchantLookup = {
  byId: (id: string) => LocalMerchant | null
  forSpelling: (raw: string) => LocalMerchant | null
}

export const merchantLookup = (index: MerchantIndex): MerchantLookup => {
  const byId = new Map(
    index.merchants.map((merchant) => [merchant.id, merchant]),
  )
  const matched = new Map<string, LocalMerchant | null>()
  return {
    byId: (id) => byId.get(id) ?? null,
    forSpelling: (raw) => {
      const cached = matched.get(raw)
      if (cached !== undefined) return cached
      const suggestion = matchSuggestion(raw, index)
      const found =
        suggestion && suggestion.score >= AUTO_MATCH_SCORE
          ? suggestion.merchant
          : null
      matched.set(raw, found)
      return found
    },
  }
}

/**
 * Bind the merchant this row names and pre-fill its learned category. Run **before** the
 * duplicate check: a bound merchant is part of a row's fingerprint.
 *
 * The row is returned as it came when nothing matched — a prediction pass must not cost an
 * allocation per row of the file.
 */
export const predictRow = (
  row: ParsedRow,
  mapping: Mapping,
  merchants: MerchantLookup,
  categoryTypes: Readonly<Record<string, TxType>>,
): ParsedRow => {
  if (row.draft === null || row.intent !== 'cashflow') return row
  const column = roleColumn(mapping.roles, 'merchant')
  const bound = row.draft.merchantId ?? null
  const raw = column < 0 ? '' : (row.raw[column] ?? '').trim()
  // An explicit "leave it in the note" outranks the matcher: the user already answered.
  if (
    bound === null &&
    lookup(mapping.aliases.merchants, normalizeKey(raw))?.kind === 'skip'
  ) {
    return row
  }
  const merchant =
    bound !== null
      ? merchants.byId(bound)
      : raw
        ? merchants.forSpelling(raw)
        : null
  if (merchant === null) return row

  const prediction = predictionFor(merchant)
  const guessed = row.issues.some(
    (issue) => issue.code === ROW_ISSUES.categoryDefaulted,
  )
  // A learned category only applies to the direction the row is being filed as — a
  // merchant seen as a refund does not make this spend a refund — and only while it exists.
  const fits =
    prediction !== null &&
    lookup(categoryTypes, prediction.categoryId) === row.draft.type
  const applies =
    prediction !== null && prediction.apply && fits && guessed
      ? prediction
      : null
  const applied = applies !== null

  const draft = {
    ...row.draft,
    merchantId: merchant.id,
    ...(applies === null ? {} : { categoryId: applies.categoryId }),
  }

  return {
    ...row,
    draft,
    fingerprint: fingerprintOf(draft),
    issues: applied
      ? row.issues.filter(
          (issue) => issue.code !== ROW_ISSUES.categoryDefaulted,
        )
      : row.issues,
    prediction:
      prediction === null || !fits
        ? null
        : {
            merchantId: merchant.id,
            merchantName: merchant.displayName,
            categoryId: prediction.categoryId,
            applied,
          },
  }
}
