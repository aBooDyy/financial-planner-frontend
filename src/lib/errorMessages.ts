/**
 * Maps the backend's stable error `code` to a user-facing message. This is a stand-in for
 * the future i18n catalog — the contract is that the UI keys off `code`, never the wire
 * `message`. Add a code here when the backend introduces one, and when the client itself
 * mints one (the `import.file.*` / `import.row.*` families are read from the file, never
 * from the wire).
 *
 * One map, one language: there is no second locale to keep in step yet. When one arrives,
 * this module is the seam — the codes stay, the strings move.
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
  'onboarding.category_unknown': 'Pick categories from the starter set.',
  'balances.settings.base_currency_invalid': 'Choose a supported currency.',
  'settings.category.name_required': 'Give the category a name.',
  'settings.category.slug_taken': 'A category like that already exists.',
  'settings.category.in_use':
    'Something is filed under this category — pick where it moves first.',
  'settings.category.required':
    'Savings and the two “Other” categories can’t be deleted.',
  'settings.category.parent_invalid': 'That category is no longer there.',
  'settings.category.parent_not_root':
    'A subcategory can’t have subcategories of its own.',
  'settings.category.parent_type_mismatch':
    'A category can only move under one of the same kind — spending or income.',
  'settings.category.has_subcategories':
    'It has subcategories — move or delete them before it can become one.',
  'settings.category.has_budget':
    'It has a budget, and budgets are set on top-level categories only.',
  'settings.category.required_top_level':
    'Savings and the two “Other” categories stay at the top level.',
  'balances.rate.value_invalid': 'Enter a valid exchange rate.',
  'spending.transaction.amount_invalid': 'Enter a valid amount.',
  'spending.transaction.currency_invalid': 'Choose a supported currency.',
  'spending.transaction.date_invalid': 'Enter a valid date.',
  'spending.transaction.category_required': 'Pick a category.',
  'spending.transaction.category_invalid': 'Choose one of your categories.',
  'spending.transaction.category_type_mismatch':
    'Pick a category of the same kind — spending or income.',
  'planning.bill.category_invalid': 'Choose one of your categories.',
  'planning.bill.category_type_mismatch':
    'A bill is filed under a spending category.',
  'goals.income.category_invalid': 'Choose one of your categories.',
  'goals.income.category_type_mismatch':
    'Income is filed under an income category.',
  'goals.goal.use_category_invalid': 'Choose one of your categories.',
  'goals.goal.use_category_type_mismatch':
    'Spending from a goal is filed under a spending category.',
  'planned.category_invalid': 'Choose one of your categories.',
  'planned.category_type_mismatch':
    'Pick a category of the same kind — spending or income.',
  'spending.budget.category_invalid': 'Choose one of your categories.',
  'spending.budget.category_not_root':
    'A budget covers a whole category, not a subcategory.',
  'spending.budget.wallet_invalid': 'Choose one of your accounts.',
  'merchants.learned_category_invalid': 'Choose one of your categories.',
  'integrations.key.category_invalid': 'Choose one of your categories.',
  'inbound.import.category_invalid': 'Choose one of your categories.',
  'spending.transaction.merchant_invalid': 'Choose one of your merchants.',
  'planning.bill.merchant_invalid': 'Choose one of your merchants.',
  'planning.bill.end_date_invalid':
    'A bill that repeats can end on a date; one-offs can’t.',
  'goals.income.merchant_invalid': 'Choose one of your merchants.',
  'spending.transaction.wallet_invalid': 'Choose one of your accounts.',
  'spending.transaction.goal_invalid': 'That goal is no longer available.',
  'spending.transaction.bill_invalid': 'That bill is no longer available.',
  'spending.transaction.type_invalid': 'Choose spending or income.',
  'spending.transaction.transfer_leg':
    'This is one side of a transfer — change or delete the transfer instead.',
  'spending.transaction.transfer_via_transfers':
    'A transfer between accounts is recorded as a transfer.',
  'spending.transfer.same_wallet': 'A transfer needs two different accounts.',
  'spending.transfer.wallet_invalid': 'Choose one of your accounts.',
  'spending.transfer.amount_invalid': 'Enter a valid amount.',
  'spending.transfer.to_amount_required':
    'Enter the amount the other account received.',
  'spending.transfer.to_amount_mismatch':
    'Between accounts in one currency, the amount received is the amount sent.',
  'common.validation': 'Some details weren’t accepted.',
  'spending.transaction.planned_invalid':
    'That upcoming item is no longer available.',
  'spending.transaction.adjustment_refs':
    'A balance adjustment has no category, goal or merchant.',
  'spending.transaction.adjustment_currency':
    'A balance adjustment must be in its wallet’s currency.',
  'spending.transaction.type_change':
    'A balance adjustment can’t become income or spending, or the other way round.',
  'planning.set_aside.planned_invalid':
    'That upcoming set-aside is no longer available.',
  'planning.set_aside.already_released': 'That money was already freed up.',
  'planning.set_aside.owner_closed':
    'That bill or goal is done — reopen it to set money aside for it.',
  'planning.close.too_many_set_asides':
    'There is too much set aside for this to close in one go. Free or move some of it first.',
  'spending.transaction.bill_type_mismatch':
    'Only spending can pay a bill — unlink the bill or make it spending.',
  'planned.bill_invalid': 'That bill is no longer available.',
  'balances.settings.main_income_invalid':
    'That income is no longer available.',
  'settings.category.spend_class_invalid':
    'Only spending categories are sorted into needs, wants and savings.',
  // Minted by the planned slice (`PlannedActionError`), and the server's own planned codes.
  'planned.not_found': 'That upcoming item is no longer available.',
  'planned.not_open': 'That upcoming item is already confirmed or skipped.',
  'planned.no_wallet': 'Choose the account it comes from or goes into.',
  'planned.bad_amount': 'Enter an amount above zero.',
  'planned.has_settlements':
    'Something is already confirmed against it — close the rest instead.',
  'planned.not_manual':
    'Upcoming set-asides for a goal can be skipped, not deleted.',
  'planned.origin_gone': 'The bill or goal this belonged to has been deleted.',
  'planned.owner_closed':
    'That bill or goal is done or paused — reopen or resume it to set money aside.',
  'merchants.not_found': 'That merchant is no longer available.',
  'merchants.name_required': 'Give the merchant a name.',
  'merchants.alias.taken': 'Another merchant already answers to that spelling.',
  'merchants.alias.invalid':
    'Add a Latin letter or digit so this merchant can be recognised.',
  'merchants.alias.not_found': 'That spelling is no longer on file.',
  'merchants.merge.same': 'Pick a different merchant to merge into.',
  'merchants.id_taken': 'That merchant already exists.',
  'inbound.import.incomplete':
    'Add the amount and currency from the details below.',
  'inbound.import.already_resolved': 'This import was already reviewed.',
  'inbound.import.not_found': 'That import is no longer available.',
  'inbound.import.wallet_invalid': 'Choose one of your accounts.',
  'email_sync.connection.not_found': 'That inbox is no longer connected.',
  'email_sync.provider.fetch_failed':
    'Couldn’t reach your inbox provider. Try again.',
  'email_sync.provider.not_configured':
    'That inbox needs reconnecting before it can be scanned.',
  'email_sync.sync.window_invalid':
    'Pick a scan window between 1 and 180 days.',
  'email_sync.sync.limit_invalid':
    'That scan is too large. Try a shorter window.',
  'email_sync.sync.message_failed':
    'Some alerts in this inbox couldn’t be imported. They’ll be retried.',
  'email_sync.rule.invalid': 'That rule couldn’t be saved.',
  'email_sync.rule.limit_reached':
    'An inbox can have up to 20 rules. Remove one to add another.',
  'email_sync.rule.name_required':
    'Give the rule a name of 120 characters or fewer.',
  'email_sync.rule.senders_invalid':
    'Add between 1 and 10 sender addresses, each a full email address.',
  'email_sync.rule.term_invalid':
    'Each word or phrase must be 1–100 characters, up to 10 per list.',
  'email_sync.rule.template_invalid':
    'Pick what to read again — this rule’s reading no longer works.',
  'email_sync.rule.decimal_invalid': 'Choose how the amount writes decimals.',
  'email_sync.rule.currency_invalid':
    'Choose a currency Means knows, or read it from the email.',
  'email_sync.rule.wallet_invalid': 'Choose one of your accounts.',
  'email_sync.rule.category_invalid': 'Choose one of your categories.',
  'email_sync.rule.auto_confirm_needs_wallet':
    'Choose an account first — Means needs to know where to post.',
  'email_sync.rule.pick_invalid':
    'That line isn’t in the sample email any more. Tap it again.',
  'email_sync.rule.samples_invalid':
    'Those sample emails couldn’t be read. Reload the inbox and try again.',
  // Not a failure: the inbox is being read right now, and nothing asked for is lost.
  'email_sync.sync.in_progress':
    'A scan of your inbox is already running. This one will pick up where it leaves off.',
  'integrations.key.not_found': 'That key no longer exists.',
  'integrations.key.name_required':
    'Give the key a name of 120 characters or fewer.',
  'integrations.key.name_taken': 'You already have a key with that name.',
  'integrations.key.expiry_invalid': 'Choose an expiry date in the future.',
  'integrations.key.wallet_invalid': 'Choose one of your accounts.',
  'integrations.key.currency_invalid': 'Choose a supported currency.',
  'integrations.key.rate_limit_invalid':
    'Set a rate limit between 1 and 600 requests a minute.',
  'integrations.key.auto_confirm_needs_wallet':
    'Choose a default account first — Means needs to know which account to post to.',
  'integrations.key.limit_reached':
    'You’ve reached the most keys you can have. Delete one you no longer use.',
  'integrations.key.revoked':
    'That key is revoked. Rotate it or create a new one.',
  'integrations.rule.invalid': 'That rule couldn’t be saved.',
  'integrations.rule.path_invalid':
    'That path isn’t valid. Use a form like $.data.amount.',
  'integrations.rule.regex_invalid': 'That pattern isn’t a valid expression.',
  'integrations.rule.field_unknown': 'Means doesn’t know that field.',
  'integrations.rule.limit_reached':
    'This key has the most rules it can hold. Remove one first.',
  'integrations.auth.missing': 'This endpoint needs an integration key.',
  'integrations.auth.invalid': 'That integration key isn’t valid.',
  'integrations.auth.expired': 'That integration key has expired.',
  'integrations.auth.revoked': 'That integration key was revoked.',
  'integrations.payload.invalid': 'The request body isn’t valid JSON.',
  'integrations.payload.too_large': 'The request body is too large.',
  'integrations.rate.limited':
    'Too many requests. Wait a moment and try again.',
  'import.file.empty': 'That file has no rows in it.',
  'import.file.too_large': 'That file is too big. Split it by date range.',
  'import.file.too_many_rows':
    'That file has too many rows. Split it by date range.',
  'import.file.single_column':
    'Only one column was found. Check the separator in Adjust.',
  'import.file.unreadable': 'That file couldn’t be read as a CSV.',
  'import.file.cancelled': 'Reading the file was cancelled.',
  'import.row.date_unreadable': 'This date can’t be read.',
  'import.row.date_ambiguous':
    'This column could be day-first or month-first — check the format.',
  'import.row.date_implausible':
    'That date looks wrong. Check it before importing.',
  'import.row.amount_unreadable': 'This amount can’t be read.',
  'import.row.amount_ambiguous':
    'This row has both a money-in and a money-out amount.',
  'import.row.amount_missing': 'This row has no amount.',
  'import.row.amount_zero': 'This row’s amount is zero.',
  'import.row.currency_unsupported': 'That currency isn’t recognised.',
  'import.row.currency_mismatch':
    'This row’s currency differs from the account’s.',
  'import.row.wallet_unresolved':
    'This row has no account. Mark the account column in Columns, match its value in Values, or set an account for rows with none.',
  'import.row.category_defaulted': 'Category guessed — no match in the file.',
  'import.row.category_type_mismatch':
    'This category is for the other direction — pick one for money in or money out to match the row.',
  'import.row.category_missing':
    'This category no longer exists — pick another for this row.',
  'import.row.type_defaulted':
    'Money in or out was guessed — that word isn’t mapped yet.',
  'import.row.ragged': 'This row has fewer columns than the header.',
  'import.row.transfer_unpaired':
    'This transfer has no other side — no matching row in another account, and the note names none. Edit the row to pick the other account.',
  'import.row.transfer_guessed': 'Other account read from the note — check it.',
  'import.row.transfer_same_wallet': 'A transfer needs two different accounts.',
  'import.row.transfer_currency':
    'The other account is in a different currency.',
  'import.template.not_found': 'That template is no longer available.',
  'import.template.name_required':
    'Give the template a name (120 characters or fewer).',
  'import.template.name_taken': 'You already have a template with that name.',
  'import.template.signature_invalid':
    'That file’s columns can’t be recognised, so the mapping can’t be saved.',
  'import.template.config_invalid': 'That mapping is too large to save.',
  'import.template.source_invalid':
    'That template is for a different kind of file.',
  'import.template.id_taken': 'That template already exists.',
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
