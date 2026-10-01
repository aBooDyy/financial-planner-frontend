import { fromWireCurrency } from '#/lib/currency'
import { toSetAside } from '#/features/setAsides/api/types'
import type { CloseEffectWire, SetAside } from '#/features/setAsides/api/types'
import type { CurrencyCode } from '#/lib/currency'
import {
  fromWireObligationFreq,
  fromWireUnit,
} from '#/features/goals/api/types'
import type {
  IntervalUnit,
  IntervalUnitWire,
  ObligationFrequency,
  ObligationFrequencyWire,
  PlanWire,
} from '#/features/goals/api/types'

// --- Domain (camelCase) --------------------------------------------------------------

/** Something the user has to pay, once (`frequency: null`) or on a schedule. */
export type Bill = {
  id: string
  name: string
  /** Per occurrence; 0 for a bill whose amount is not known yet. */
  amount: number
  currency: CurrencyCode
  /** Null = "Just once": `nextDue` is its only occurrence. */
  frequency: ObligationFrequency | null
  /** "Every `customInterval` `customUnit`s" — set exactly when `frequency` is 'custom'. */
  customInterval: number | null
  customUnit: IntervalUnit | null
  /** The next open occurrence, advanced by the client as occurrences settle. */
  nextDue: string
  /** Repeating bills only: the last date an occurrence may fall on. */
  endsOn: string | null
  /** "Paid from". */
  walletId: string | null
  /** "Save in"; null = the paid-from wallet. */
  saveWalletId: string | null
  /** A spend category; required. */
  categoryId: string
  merchantId: string | null
  note: string | null
  /** "Log it automatically on the due date". */
  autopay: boolean
  /** False = "Nice to have". */
  mustPay: boolean
  color: string
  position: number
  /** Set by Mark as done / End this bill; cleared by Reopen. */
  closedAt: string | null
  plannedAt: string | null
  planAmount: number | null
  planCount: number | null
  planStart: string | null
  setAsideDay: number | null
  createdAt: string
  updatedAt: string
  version: string
}

// --- Wire (snake_case) ---------------------------------------------------------------

export type BillWire = {
  id: string
  name: string
  amount: number
  currency: string
  frequency: ObligationFrequencyWire | null
  custom_interval: number | null
  custom_unit: IntervalUnitWire | null
  next_due: string
  ends_on: string | null
  wallet_id: string | null
  save_wallet_id: string | null
  category_id: string
  merchant_id: string | null
  note: string | null
  autopay: boolean
  must_pay: boolean
  color: string
  position: number
  closed_at: string | null
  planned_at: string | null
  plan_amount: number | null
  plan_count: number | null
  plan_start: string | null
  set_aside_day: number | null
  created_at: string
  updated_at: string
  version: string
}

export type CreateBillWire = PlanWire & {
  id: string
  name: string
  amount: number
  currency: string
  frequency: ObligationFrequencyWire | null
  custom_interval: number | null
  custom_unit: IntervalUnitWire | null
  next_due: string
  ends_on: string | null
  wallet_id: string | null
  save_wallet_id: string | null
  category_id: string
  merchant_id: string | null
  note: string | null
  autopay: boolean
  must_pay: boolean
  color: string
  position: number
}

/**
 * A full representation: an omitted nullable field is cleared, an omitted `must_pay` reads as
 * true and `autopay` as false. `closed_at` is not in it — only the actions move it.
 */
export type UpdateBillWire = Omit<CreateBillWire, 'id'> & { version: string }

export type CloseBillResultWire = CloseEffectWire & { bill: BillWire }

export type CloseBillResult = {
  bill: Bill
  released: SetAside[]
  created: SetAside[]
}

// --- Mappers (wire → domain) ---------------------------------------------------------

export const toBill = (w: BillWire): Bill => ({
  id: w.id,
  name: w.name,
  amount: w.amount,
  currency: fromWireCurrency(w.currency),
  frequency: w.frequency ? fromWireObligationFreq(w.frequency) : null,
  customInterval: w.custom_interval ?? null,
  customUnit: w.custom_unit ? fromWireUnit(w.custom_unit) : null,
  nextDue: w.next_due,
  endsOn: w.ends_on ?? null,
  walletId: w.wallet_id ?? null,
  saveWalletId: w.save_wallet_id ?? null,
  categoryId: w.category_id,
  merchantId: w.merchant_id ?? null,
  note: w.note ?? null,
  autopay: w.autopay,
  mustPay: w.must_pay,
  color: w.color,
  position: w.position,
  closedAt: w.closed_at ?? null,
  plannedAt: w.planned_at ?? null,
  planAmount: w.plan_amount ?? null,
  planCount: w.plan_count ?? null,
  planStart: w.plan_start ?? null,
  setAsideDay: w.set_aside_day ?? null,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toCloseBillResult = (w: CloseBillResultWire): CloseBillResult => ({
  bill: toBill(w.bill),
  released: w.released.map(toSetAside),
  created: w.created.map(toSetAside),
})
