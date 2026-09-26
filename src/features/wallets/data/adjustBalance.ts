import type { AdjustmentType } from '#/features/transactions/api/types'
import { formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { TransferWallet } from './transferDialog'

/** What gets recorded to move a wallet from its live balance to the real one. */
export type BalanceAdjustment = { type: AdjustmentType; amount: number }

/** `null` when the wallet already holds the target — there is nothing to record. */
export function adjustmentFor(
  current: number,
  target: number,
): BalanceAdjustment | null {
  const difference = target - current
  if (difference === 0) return null
  return {
    type: difference > 0 ? 'adjustment_in' : 'adjustment_out',
    amount: Math.abs(difference),
  }
}

export type AdjustPreview = {
  hasTarget: boolean
  current: number
  /** The balance once adjusted: the target, or the current balance until one is typed. */
  next: number
  /** Signed, target − current; 0 until a target is typed. */
  difference: number
  adjustment: BalanceAdjustment | null
  canSubmit: boolean
}

export function previewAdjustment(
  wallet: TransferWallet,
  targetMinor: number | null,
): AdjustPreview {
  const hasTarget = targetMinor !== null
  const next = targetMinor ?? wallet.balance
  const adjustment = adjustmentFor(wallet.balance, next)
  return {
    hasTarget,
    current: wallet.balance,
    next,
    difference: next - wallet.balance,
    adjustment,
    canSubmit: adjustment !== null,
  }
}

/** "+SR 120.00", "−SR 40.00", or "No change". */
export function differenceLabel(
  difference: number,
  currency: CurrencyCode,
): string {
  if (difference === 0) return 'No change'
  const sign = difference > 0 ? '+' : '−'
  return `${sign}${formatMoney(Math.abs(difference), currency)}`
}

export function adjustSubmitLabel(preview: AdjustPreview): string {
  if (!preview.hasTarget) return 'Enter the actual balance'
  if (!preview.adjustment) return 'Already matches'
  return 'Adjust balance'
}

export type AdjustDoneSummary = { title: string; sub: string }

export function adjustDoneSummary(
  wallet: TransferWallet,
  adjustment: BalanceAdjustment,
  next: number,
): AdjustDoneSummary {
  const signed =
    adjustment.type === 'adjustment_in' ? adjustment.amount : -adjustment.amount
  return {
    title: `${wallet.name} is now ${formatMoney(next, wallet.currency)}`,
    sub: `Recorded a ${differenceLabel(signed, wallet.currency)} balance adjustment`,
  }
}
