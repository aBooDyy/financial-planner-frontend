import { ApiError } from '#/lib/apiError'
import { messageForApiError, messageForCode } from '#/lib/errorMessages'

/** A form field a key error can sit beside. */
export type KeyField =
  | 'name'
  | 'expiresAt'
  | 'defaultWalletId'
  | 'defaultCategoryId'
  | 'defaultCurrency'
  | 'autoConfirm'
  | 'rateLimitPerMinute'

export type KeyFailure = {
  /** Messages to show beside their fields. */
  fields: Partial<Record<KeyField, string>>
  /** A message about the key as a whole, when the error names no field. */
  general: string | null
}

const FIELD_OF_WIRE: Partial<Record<string, KeyField>> = {
  name: 'name',
  expires_at: 'expiresAt',
  default_wallet_id: 'defaultWalletId',
  default_category_id: 'defaultCategoryId',
  default_currency: 'defaultCurrency',
  auto_confirm: 'autoConfirm',
  rate_limit_per_minute: 'rateLimitPerMinute',
}

const FIELD_OF_CODE: Partial<Record<string, KeyField>> = {
  'integrations.key.name_required': 'name',
  'integrations.key.name_taken': 'name',
  'integrations.key.expiry_invalid': 'expiresAt',
  'integrations.key.wallet_invalid': 'defaultWalletId',
  'integrations.key.category_invalid': 'defaultCategoryId',
  'integrations.key.currency_invalid': 'defaultCurrency',
  'integrations.key.rate_limit_invalid': 'rateLimitPerMinute',
  'integrations.key.auto_confirm_needs_wallet': 'autoConfirm',
}

/**
 * Keys are online-only, so a 409 here is never a sync conflict to rebase: `name_taken` is a
 * uniqueness answer about one field, and the user fixes it where they typed it. A 422 names
 * every failing field in its details, and each goes beside its own control.
 */
export const keyFailure = (error: unknown): KeyFailure => {
  const fields: Partial<Record<KeyField, string>> = {}
  const details = error instanceof ApiError ? error.details : []
  for (const detail of details) {
    const field = FIELD_OF_WIRE[detail.field] ?? FIELD_OF_CODE[detail.code]
    if (field && !fields[field]) fields[field] = messageForCode(detail.code)
  }
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : ''
  const topField = FIELD_OF_CODE[code]
  if (topField && !fields[topField]) fields[topField] = messageForCode(code)

  return {
    fields,
    general: Object.keys(fields).length > 0 ? null : messageForApiError(error),
  }
}

/** One line for a place that has no field to point at — a confirm dialog, a footer. */
export const failureMessage = (
  failure: KeyFailure,
  shown: ReadonlyArray<KeyField> = [],
): string | null => {
  const elsewhere = Object.entries(failure.fields)
    .filter(([field]) => !shown.includes(field as KeyField))
    .map(([, message]) => message)
  const lines = [failure.general, ...elsewhere].filter(Boolean)
  return lines.length > 0 ? lines.join(' ') : null
}
