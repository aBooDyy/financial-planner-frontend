import type { LocalBill } from '#/db/types'
import type { BillDraft } from './mutations'

/** The repeat fields as the server keeps them: an interval only with 'custom', an end only when repeating. */
export function shaped(bill: LocalBill): LocalBill {
  const custom = bill.frequency === 'custom'
  return {
    ...bill,
    customInterval: custom ? bill.customInterval : null,
    customUnit: custom ? bill.customUnit : null,
    endsOn: bill.frequency ? bill.endsOn : null,
  }
}

/** A new bill's stored row. */
export const billRowOf = (
  draft: BillDraft,
  at: { id: string; position: number; ts: string },
): LocalBill =>
  shaped({
    id: at.id,
    name: draft.name,
    amount: draft.amount,
    currency: draft.currency,
    frequency: draft.frequency,
    customInterval: draft.customInterval ?? null,
    customUnit: draft.customUnit ?? null,
    nextDue: draft.nextDue,
    endsOn: draft.endsOn ?? null,
    walletId: draft.walletId,
    saveWalletId: draft.saveWalletId ?? null,
    categoryId: draft.categoryId,
    merchantId: draft.merchantId ?? null,
    note: draft.note ?? null,
    autopay: draft.autopay ?? false,
    mustPay: draft.mustPay ?? true,
    amountVaries: draft.amountVaries ?? false,
    color: draft.color,
    position: at.position,
    closedAt: null,
    plannedAt: null,
    planAmount: null,
    planCount: null,
    planStart: null,
    setAsideDay: draft.setAsideDay ?? null,
    createdAt: at.ts,
    updatedAt: at.ts,
    // Placeholder until the first sync returns the server's sha256 version.
    version: '',
    dirty: 1,
    deleted: 0,
  })
