/**
 * Pay now's effect line (03 §5): what leaves the paying wallet, and how much of it the
 * occurrence's own set-asides in that wallet cover. Pure.
 */
import type { LocalSetAside } from '#/db/types'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { money } from './format'

/** What the occurrence holds in `walletId`, in the bill's currency. */
export function heldInWallet(args: {
  billId: string
  occurrence: string
  walletId: string
  setAsides: ReadonlyArray<LocalSetAside>
  currency: CurrencyCode
  rates: RatesMap
}): number {
  return args.setAsides
    .filter(
      (a) =>
        isLiveSetAside(a) &&
        a.billId === args.billId &&
        a.occurrence === args.occurrence &&
        a.source === 'wallet' &&
        a.walletId === args.walletId,
    )
    .reduce(
      (sum, a) =>
        sum + convertMinor(a.amount, a.currency, args.currency, args.rates),
      0,
    )
}

/** "SR 2,400 leaves Main bank." and where it comes from. */
export function payEffect(args: {
  amount: number
  held: number
  walletName: string
  currency: CurrencyCode
}): [string, string] {
  const { amount, held, walletName, currency } = args
  const first = `${money(amount, currency)} leaves ${walletName}.`
  if (held <= 0)
    return [first, 'Nothing was set aside there, so it comes from free money.']
  if (held >= amount)
    return [
      first,
      held > amount
        ? `It comes from what you set aside; ${money(held - amount, currency)} stays set aside.`
        : 'It all comes from what you set aside.',
    ]
  return [
    first,
    `${money(held, currency)} comes from what you set aside, ${money(amount - held, currency)} from free money.`,
  ]
}
