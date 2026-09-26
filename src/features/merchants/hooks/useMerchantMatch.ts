import type { LocalMerchant } from '#/db/types'
import type {
  MerchantIndex,
  MerchantMatch,
} from '#/features/merchants/data/matching'
import {
  AUTO_MATCH_SCORE,
  CHECK_MATCH_SCORE,
  matchMerchant,
} from '#/features/merchants/data/matching'
import { useMerchantIndex } from './useMerchants'

/**
 * What a matched merchant says about a row's category — the one place `auto_categorize` is
 * read. The backend stores the flag and deliberately never acts on it: with the merchant
 * cache synced and matched client-side, on means apply it silently, off means offer it.
 */
export type CategoryPrediction = {
  /** The leaf the merchant was last filed under; its type is the category's. */
  categoryId: string
  /** True ⇒ apply without asking. False ⇒ show it as a suggestion. */
  apply: boolean
}

export type MerchantSuggestion = MerchantMatch & {
  /** At or above the auto threshold the match is treated as a fact, not a guess. */
  confident: boolean
  prediction: CategoryPrediction | null
}

export function predictionFor(
  merchant: LocalMerchant,
): CategoryPrediction | null {
  if (!merchant.learnedCategoryId) return null
  return {
    categoryId: merchant.learnedCategoryId,
    apply: merchant.autoCategorize,
  }
}

export function suggestionFrom(
  match: MerchantMatch | null,
): MerchantSuggestion | null {
  if (!match || match.score < CHECK_MATCH_SCORE) return null
  return {
    ...match,
    confident: match.score >= AUTO_MATCH_SCORE,
    prediction: predictionFor(match.merchant),
  }
}

/** Match a raw spelling against the synced cache, headlessly (import reuses this). */
export const matchSuggestion = (
  raw: string,
  index: MerchantIndex,
): MerchantSuggestion | null => suggestionFrom(matchMerchant(raw, index))

/** The best merchant for a raw spelling, live against the local cache. */
export function useMerchantMatch(raw: string): MerchantSuggestion | null {
  const index = useMerchantIndex()
  return matchSuggestion(raw, index)
}
