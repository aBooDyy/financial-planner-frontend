import {
  convertMinor,
  formatMoney,
  minorToInputValue,
  parseAmountToMinor,
} from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'

/** What the destination receives by today's rates, as an editable input string. */
export function suggestReceived(
  amount: string,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RatesMap,
): string {
  const minor = parseAmountToMinor(amount, from)
  if (minor === null || minor <= 0) return ''
  return minorToInputValue(convertMinor(minor, from, to, rates), to)
}

export const SAME_ACCOUNT_ERROR = 'Pick two different accounts.'

/** The line under the quick-add transfer row. */
export function transferHint(
  fromName: string,
  toName: string,
  sameAccount: boolean,
  amountMinor: number | null,
  currency: CurrencyCode,
): string {
  if (sameAccount) return SAME_ACCOUNT_ERROR
  if (amountMinor !== null && amountMinor > 0) {
    return `${fromName} → ${toName} · ${formatMoney(amountMinor, currency)}`
  }
  return 'Moves money between your accounts — not counted as spending.'
}

export type TransferDraftFields = {
  walletId: string
  toWalletId: string
  amount: string
  toAmount: string
}

export type ResolvedTransfer = {
  amount: number
  fromCurrency: CurrencyCode
  toAmount: number
  toCurrency: CurrencyCode
}

/** The transfer's two legs in minor units, or `null` while the draft can't be saved. */
export function resolveTransfer(
  draft: TransferDraftFields,
  currencyOf: (walletId: string) => CurrencyCode,
  missingSide?: 'from' | 'to',
): ResolvedTransfer | null {
  const { walletId, toWalletId } = draft
  const survivor = missingSide === 'from' ? toWalletId : walletId
  if (missingSide && !survivor) return null
  if (!missingSide && (!walletId || !toWalletId || walletId === toWalletId))
    return null
  const fromCurrency = currencyOf(missingSide ? survivor : walletId)
  const toCurrency = currencyOf(missingSide ? survivor : toWalletId)
  const amount = parseAmountToMinor(draft.amount, fromCurrency) ?? 0
  const toAmount =
    fromCurrency === toCurrency
      ? amount
      : (parseAmountToMinor(draft.toAmount, toCurrency) ?? 0)
  if (amount <= 0 || toAmount <= 0) return null
  return { amount, fromCurrency, toAmount, toCurrency }
}
