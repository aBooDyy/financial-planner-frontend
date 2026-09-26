import { useState } from 'react'
import type { SyncFailure } from '#/db/types'
import type { TxEditorDraft } from './useTxEditor'

/** The draft value each field the server may name is edited through. */
const DRAFT_KEY: Partial<Record<string, keyof TxEditorDraft>> = {
  amount: 'amount',
  currency: 'walletId',
  wallet_id: 'walletId',
  from_wallet_id: 'walletId',
  to_wallet_id: 'toWalletId',
  to_amount: 'toAmount',
  category_id: 'categoryId',
  merchant_id: 'merchantId',
  goal_id: 'goalId',
  planned_id: 'plannedId',
  date: 'date',
}

/**
 * The field a refused sync named, while the user has not changed it yet — the form marks it
 * so they know where to look, and lets go once they have touched it.
 */
export function useFlaggedField(
  failure: SyncFailure | null,
  draft: TxEditorDraft,
): string | null {
  const [opened] = useState(draft)
  const field = failure?.kind === 'rejected' ? failure.field : null
  const key = field ? DRAFT_KEY[field] : undefined
  if (!field || !key) return null
  return draft[key] === opened[key] ? field : null
}
