/**
 * A payment releases set-asides **only in the wallet it was paid from** (03 §5): the owner's
 * live set-asides in that wallet — for a bill, those of the occurrence paid — oldest first, up
 * to the amount paid. Anything the payment needs beyond them comes out of the wallet's free
 * money; set-asides in other wallets are left for the user to decide on (`leftoverFor`).
 */
import { db } from '#/db/db'
import type { LocalSetAside } from '#/db/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { releaseSetAsides } from './batches'
import type { SetAsidePart } from './batches'
import { isLiveSetAside } from './totals'

/** What a payment was for: a goal, or one occurrence of a bill. */
export type PaidFor =
  | { goalId: string }
  | { billId: string; occurrence: string }

const oldestFirst = (a: LocalSetAside, b: LocalSetAside): number =>
  a.date.localeCompare(b.date) ||
  a.createdAt.localeCompare(b.createdAt) ||
  a.id.localeCompare(b.id)

/** The owner's live set-asides in `walletId` — for a bill, of that occurrence — oldest first. */
export function heldInWallet(
  setAsides: ReadonlyArray<LocalSetAside>,
  paidFor: PaidFor,
  walletId: string,
): LocalSetAside[] {
  return setAsides
    .filter(
      (a) =>
        isLiveSetAside(a) &&
        a.source === 'wallet' &&
        a.walletId === walletId &&
        ('goalId' in paidFor
          ? a.goalId === paidFor.goalId
          : a.billId === paidFor.billId && a.occurrence === paidFor.occurrence),
    )
    .sort(oldestFirst)
}

/**
 * The parts a payment of `amount` (in `currency`) from `walletId` releases: whole rows oldest
 * first, the last one in part when the payment ends inside it.
 */
export function releasesForPayment(
  setAsides: ReadonlyArray<LocalSetAside>,
  paidFor: PaidFor,
  walletId: string,
  amount: number,
  currency: CurrencyCode,
  rates: RatesMap,
): SetAsidePart[] {
  const parts: SetAsidePart[] = []
  let left = amount
  for (const row of heldInWallet(setAsides, paidFor, walletId)) {
    if (left <= 0) break
    const whole = convertMinor(row.amount, row.currency, currency, rates)
    if (whole <= left) {
      parts.push({ id: row.id })
      left -= whole
      continue
    }
    const part = convertMinor(left, currency, row.currency, rates)
    if (part > 0) parts.push({ id: row.id, amount: Math.min(part, row.amount) })
    left = 0
  }
  return parts
}

/**
 * Release what a payment used, as one batch carrying the payment's id. Returns the parts
 * released (none when the wallet held nothing for it).
 */
export async function releaseForPayment(
  paidFor: PaidFor,
  payment: {
    id: string
    walletId: string
    amount: number
    currency: CurrencyCode
    date: string
  },
  rates: RatesMap,
): Promise<SetAsidePart[]> {
  const owned =
    'goalId' in paidFor
      ? await db.setAsides.where('goalId').equals(paidFor.goalId).toArray()
      : await db.setAsides.where('billId').equals(paidFor.billId).toArray()
  const parts = releasesForPayment(
    owned,
    paidFor,
    payment.walletId,
    payment.amount,
    payment.currency,
    rates,
  )
  await releaseSetAsides(parts, {
    releasedAt: payment.date,
    releasedById: payment.id,
  })
  return parts
}
