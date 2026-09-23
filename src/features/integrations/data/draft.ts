import type { KeySettings } from '#/features/integrations/api/types'
import type { KeyField } from './errors'

export const RATE_LIMIT_MIN = 1
export const RATE_LIMIT_MAX = 600

/**
 * Apply one edit and keep the draft coherent: a default category belongs to one type, a
 * subcategory to one category, and posting without review needs somewhere to post.
 */
export function applyEdit<TField extends keyof KeySettings>(
  draft: KeySettings,
  field: TField,
  value: KeySettings[TField],
): KeySettings {
  const next = { ...draft, [field]: value }
  if (field === 'defaultType' && value !== draft.defaultType) {
    next.defaultCategory = null
    next.defaultSubcategory = null
  }
  if (field === 'defaultCategory' && value !== draft.defaultCategory) {
    next.defaultSubcategory = null
  }
  if (field === 'defaultWalletId' && value === null) next.autoConfirm = false
  return next
}

/** What the client can tell before asking; the server re-checks all of it. */
export function draftProblems(
  draft: KeySettings,
): Partial<Record<KeyField, string>> {
  const problems: Partial<Record<KeyField, string>> = {}
  const name = draft.name.trim()
  if (!name || name.length > 120) {
    problems.name = 'Give the key a name of 120 characters or fewer.'
  }
  const rate = draft.rateLimitPerMinute
  if (
    !Number.isInteger(rate) ||
    rate < RATE_LIMIT_MIN ||
    rate > RATE_LIMIT_MAX
  ) {
    problems.rateLimitPerMinute = `Set a rate limit between ${RATE_LIMIT_MIN} and ${RATE_LIMIT_MAX} requests a minute.`
  }
  if (draft.autoConfirm && draft.defaultWalletId === null) {
    problems.autoConfirm =
      'Choose a default account first — Means needs to know which account to post to.'
  }
  return problems
}
