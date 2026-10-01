import type { LocalBill } from '#/db/types'
import type {
  Bill,
  CreateBillWire,
  UpdateBillWire,
} from '#/features/bills/api/types'
import { planWire, repeatWire } from '#/features/goals/data/mappers'

/** Server bill → local record (freshly synced: clean, not deleted). */
export const serverBillToLocal = (b: Bill): LocalBill => ({
  ...b,
  dirty: 0,
  deleted: 0,
})

const billBody = (l: LocalBill): Omit<CreateBillWire, 'id'> => ({
  name: l.name,
  amount: l.amount,
  currency: l.currency,
  ...repeatWire(l),
  next_due: l.nextDue,
  // The server refuses an end date on a one-off.
  ends_on: l.frequency ? l.endsOn : null,
  wallet_id: l.walletId,
  save_wallet_id: l.saveWalletId,
  category_id: l.categoryId,
  merchant_id: l.merchantId,
  note: l.note,
  autopay: l.autopay,
  must_pay: l.mustPay,
  color: l.color,
  position: l.position,
  ...planWire(l),
})

export const localBillToCreateWire = (l: LocalBill): CreateBillWire => ({
  id: l.id,
  ...billBody(l),
})

// The update is based on the last-synced `version` (optimistic locking base).
export const localBillToUpdateWire = (l: LocalBill): UpdateBillWire => ({
  version: l.version,
  ...billBody(l),
})
