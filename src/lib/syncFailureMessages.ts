import type { SyncFailure } from '#/db/types'
import { messageForCode } from './errorMessages'

/** The names the row already shows, so a message can say which wallet rather than "a wallet". */
export type SyncFailureContext = {
  wallet?: string | null
  fromWallet?: string | null
  toWallet?: string | null
  category?: string | null
  goal?: string | null
  merchant?: string | null
}

export type SyncFailureText = {
  title: string
  detail: string
  /** What the user can do about it. */
  hint: string
  /** Whether opening the row and saving it differently can fix it. */
  canFixByEditing: boolean
}

const AUTO_RETRY = 'We’ll keep retrying automatically.'
const UNKNOWN_TITLE = 'The server refused this change'
const UNKNOWN_HINT = 'Edit it and save again, or retry later.'

function unavailable(failure: SyncFailure): SyncFailureText {
  const detail =
    failure.status === 0
      ? 'Couldn’t reach the server.'
      : failure.status === 429
        ? 'The server is busy right now.'
        : 'The server couldn’t take this change right now.'
  return {
    title: 'Not synced yet',
    detail,
    hint: AUTO_RETRY,
    canFixByEditing: false,
  }
}

const named = (noun: string, name: string | null | undefined): string =>
  name ? `The ${noun} “${name}”` : `The ${noun}`

/** A reference the row holds points at something the server no longer has. */
const gone = (
  what: string,
  name: string | null | undefined,
  hint: string,
): SyncFailureText => ({
  title: `${what[0].toUpperCase()}${what.slice(1)} no longer available`,
  detail: `${named(what, name)} is no longer available — it may have been deleted on another device.`,
  hint,
  canFixByEditing: true,
})

/** The payload itself was refused; the catalog already words each code. */
const refused = (
  failure: SyncFailure,
  title: string,
  hint: string,
  canFixByEditing = true,
): SyncFailureText => ({
  title,
  detail: messageForCode(
    failure.code,
    failure.message || 'No reason was given.',
  ),
  hint,
  canFixByEditing,
})

const FIELD_LABEL: Partial<Record<string, string>> = {
  amount: 'amount',
  to_amount: 'amount received',
  currency: 'currency',
  wallet_id: 'wallet',
  from_wallet_id: 'account it leaves',
  to_wallet_id: 'account it goes into',
  category_id: 'category',
  goal_id: 'goal it counts toward',
  bill_id: 'bill it pays',
  merchant_id: 'merchant',
  planned_id: 'upcoming item it settles',
  date: 'date',
  note: 'note',
  type: 'type',
}

const fieldHint = (field: string | null): string => {
  const label = field ? FIELD_LABEL[field] : undefined
  return label ? `Check the ${label} and save.` : UNKNOWN_HINT
}

type Rule = (failure: SyncFailure, ctx: SyncFailureContext) => SyncFailureText

const walletOf = (failure: SyncFailure, ctx: SyncFailureContext) =>
  failure.field === 'to_wallet_id'
    ? ctx.toWallet
    : failure.field === 'from_wallet_id'
      ? ctx.fromWallet
      : ctx.wallet

/** Keyed by the code's last segment: the ledger, transfers and planned rows share them. */
const BY_REASON: Partial<Record<string, Rule>> = {
  wallet_invalid: (f, ctx) =>
    gone('wallet', walletOf(f, ctx), 'Pick another wallet and save.'),
  category_invalid: (_f, ctx) =>
    gone('category', ctx.category, 'Pick another category and save.'),
  goal_invalid: (_f, ctx) =>
    gone('goal', ctx.goal, 'Change what it counts toward and save.'),
  merchant_invalid: (_f, ctx) =>
    gone(
      'merchant',
      ctx.merchant,
      'Pick another merchant or clear it and save.',
    ),
  planned_invalid: (f) =>
    refused(
      f,
      'Upcoming item no longer available',
      'Change what it counts toward and save.',
    ),
  category_required: (f) =>
    refused(f, 'Category missing', 'Pick a category and save.'),
  category_type_mismatch: (f) =>
    refused(
      f,
      'Category doesn’t match',
      'Pick a category of the same kind and save.',
    ),
  same_wallet: (f) =>
    refused(
      f,
      'Same wallet on both sides',
      'Pick two different wallets and save.',
    ),
  to_amount_required: (f) =>
    refused(
      f,
      'Amount received missing',
      'Enter the amount received and save.',
    ),
  to_amount_mismatch: (f) =>
    refused(
      f,
      'Amount received not accepted',
      'Check the amount received and save.',
    ),
  amount_invalid: (f) =>
    refused(f, 'Amount not accepted', 'Correct the amount and save.'),
  currency_invalid: (f) =>
    refused(f, 'Currency not accepted', 'Pick the wallet again and save.'),
  date_invalid: (f) =>
    refused(f, 'Date not accepted', 'Pick the date again and save.'),
  type_invalid: (f) =>
    refused(f, 'Type not accepted', 'Check the type and save.'),
  type_change: (f) =>
    refused(f, 'Change not accepted', 'Set the type back and save.'),
  adjustment_refs: (f) => refused(f, 'Change not accepted', fieldHint(f.field)),
  adjustment_currency: (f) =>
    refused(f, 'Currency not accepted', 'Check the wallet and save.'),
  transfer_leg: (f) =>
    refused(
      f,
      'Change not accepted',
      'Open the transfer and change it there.',
      false,
    ),
  transfer_via_transfers: (f) =>
    refused(
      f,
      'Change not accepted',
      'Delete it and record it as a transfer.',
      false,
    ),
  validation: (f) =>
    refused(f, 'Some details weren’t accepted', fieldHint(f.field)),
  owner_closed: (f) =>
    refused(
      f,
      'Bill or goal is done',
      'Reopen it, or set the money aside for something else.',
    ),
  too_many_set_asides: (f) =>
    refused(
      f,
      'Too much set aside to close at once',
      'Free or move some of what it holds, then close it again.',
      false,
    ),
  bill_type_mismatch: (f) =>
    refused(
      f,
      'Only spending pays a bill',
      'Unlink the bill or make it spending, and save.',
    ),
}

const reasonOf = (code: string): string => code.slice(code.lastIndexOf('.') + 1)

/** Plain-language title, detail and next step for a failed sync of one row. */
export function describeSyncFailure(
  failure: SyncFailure,
  context: SyncFailureContext = {},
): SyncFailureText {
  if (failure.kind === 'unavailable') return unavailable(failure)
  const rule = BY_REASON[reasonOf(failure.code)]
  if (rule) return rule(failure, context)
  return {
    title: UNKNOWN_TITLE,
    detail: failure.message || 'No reason was given.',
    hint: UNKNOWN_HINT,
    canFixByEditing: true,
  }
}
