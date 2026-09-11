/**
 * Maps the backend's stable error `code` to a user-facing message. This is a stand-in for
 * the future i18n catalog — the contract is that the UI keys off `code`, never the wire
 * `message`. Add a code here when the backend introduces one.
 */
const MESSAGES: Record<string, string> = {
  'auth.credentials.invalid': 'Email or password is incorrect.',
  'auth.email.taken': 'That email is already registered.',
  'auth.email.invalid': 'Enter a valid email address.',
  'auth.password.weak': 'Use at least 8 characters.',
  'auth.name.required': 'Enter your full name.',
  'auth.unauthenticated': 'Your session has expired. Please log in again.',
  'common.network': 'Can’t reach the server. Check your connection.',
  'common.conflict': 'This was changed elsewhere — reload and try again.',
  'settings.category.name_required': 'Give the category a name.',
  'settings.category.slug_taken': 'A category like that already exists.',
  'balances.rate.value_invalid': 'Enter a valid exchange rate.',
  'spending.transaction.amount_invalid': 'Enter a valid amount.',
  'spending.transaction.currency_invalid': 'Choose a supported currency.',
  'spending.transaction.date_invalid': 'Enter a valid date.',
  'spending.transaction.category_required': 'Pick a category.',
  'email_sync.import.incomplete':
    'Add the amount and currency from the email below.',
  'email_sync.import.already_resolved': 'This alert was already reviewed.',
  'email_sync.import.not_found': 'That alert is no longer available.',
  'email_sync.connection.wallet_invalid': 'Choose one of your accounts.',
  'email_sync.provider.fetch_failed':
    'Couldn’t reach your inbox provider. Try again.',
}

export const messageForCode = (
  code: string,
  fallback = 'Something went wrong. Please try again.',
): string => MESSAGES[code] ?? fallback

/** Translate any thrown value to a user-facing message via its `code` when available. */
export const messageForApiError = (error: unknown): string => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : ''
  return messageForCode(code)
}
