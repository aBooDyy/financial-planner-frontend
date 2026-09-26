import type { LocalBalanceNode } from '#/db/types'
import { suggestReceived } from '#/features/transactions/data/transferForm'
import type { RatesMap } from '#/lib/config/rates'
import { decimalsFor, formatMoney, toMajor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'
import type { IconId } from '#/lib/icons/catalog.gen'

/** A wallet as the transfer dialog sees it: its live balance in its own currency. */
export type TransferWallet = {
  id: string
  name: string
  color: string
  icon: IconId
  currency: CurrencyCode
  balance: number
}

/** Wallets with their live balance: the opening amount plus the ledger's deltas. */
export function transferWallets(
  nodes: LocalBalanceNode[],
  deltas: Record<string, number>,
  fallbackCurrency: CurrencyCode,
): TransferWallet[] {
  return nodes
    .filter((n) => n.kind === 'wallet')
    .map((n) => ({
      id: n.id,
      name: n.name,
      color: n.color,
      icon: iconIdOr(n.icon, WALLET_ICON),
      currency: n.currency ?? fallbackCurrency,
      balance: (n.amount ?? 0) + (deltas[n.id] ?? 0),
    }))
}

/** The two sides, never the same wallet. Either is undefined only with fewer than two wallets. */
export function resolvePair(
  wallets: TransferWallet[],
  fromId: string | null,
  toId: string | null,
): { from: TransferWallet | undefined; to: TransferWallet | undefined } {
  const byId = (id: string | null) => wallets.find((w) => w.id === id)
  const from = byId(fromId) ?? wallets.at(0)
  const chosenTo = byId(toId)
  const to =
    chosenTo && chosenTo.id !== from?.id
      ? chosenTo
      : wallets.find((w) => w.id !== from?.id)
  return { from, to }
}

/** The FX-derived received amount, padded to the currency's minor units ("100.00"). */
export function autoReceived(
  amount: string,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RatesMap,
): string {
  const suggested = suggestReceived(amount, from, to, rates)
  return suggested === '' ? '' : Number(suggested).toFixed(decimalsFor(to))
}

export type AfterTone = 'muted' | 'text' | 'accent' | 'danger'

/** How a card's "after" figure reads: grey until an amount exists, then by direction. */
export function afterTone(
  hasAmount: boolean,
  incoming: boolean,
  after: number,
): AfterTone {
  if (!hasAmount) return 'muted'
  if (incoming) return 'accent'
  return after < 0 ? 'danger' : 'text'
}

export type TransferPreview = {
  hasAmount: boolean
  isFx: boolean
  /** Minor units the destination receives, in its own currency. */
  received: number
  fromAfter: number
  toAfter: number
  over: boolean
  canSubmit: boolean
}

export function previewTransfer(
  from: TransferWallet,
  to: TransferWallet,
  amountMinor: number | null,
  receivedMinor: number | null,
): TransferPreview {
  const amount = amountMinor !== null && amountMinor > 0 ? amountMinor : 0
  const isFx = from.currency !== to.currency
  const received = isFx ? Math.max(receivedMinor ?? 0, 0) : amount
  const over = amount > from.balance
  return {
    hasAmount: amount > 0,
    isFx,
    received,
    fromAfter: from.balance - amount,
    toAfter: to.balance + received,
    over,
    canSubmit: amount > 0 && !over && from.id !== to.id && received > 0,
  }
}

export type AmountChip = {
  key: string
  label: string
  minor: number
  active: boolean
  disabled: boolean
}

/** Quick picks off the source balance: a quarter, a half, all of it. */
export function amountChips(
  from: TransferWallet,
  amountMinor: number | null,
): AmountChip[] {
  const picks = [
    { key: 'quarter', label: '25%', minor: Math.round(from.balance / 4) },
    { key: 'half', label: '50%', minor: Math.round(from.balance / 2) },
    {
      key: 'all',
      label: `All · ${formatMoney(from.balance, from.currency)}`,
      minor: from.balance,
    },
  ]
  return picks.map((p) => ({
    ...p,
    active: p.minor > 0 && amountMinor === p.minor,
    disabled: p.minor <= 0,
  }))
}

const RATE_DIGITS = 4

/**
 * The rate line under what arrives, always quoted so the number is ≥ 1. Uses the effective
 * rate of the entered pair when both sides exist, otherwise the stored rates.
 */
export function rateLine(
  from: CurrencyCode,
  to: CurrencyCode,
  amountMinor: number,
  receivedMinor: number,
  rates: RatesMap,
): string {
  const rateFrom = rates[from]
  const rateTo = rates[to]
  const stored = rateFrom && rateTo ? rateFrom / rateTo : Number.NaN
  const rate =
    amountMinor > 0 && receivedMinor > 0
      ? toMajor(receivedMinor, to) / toMajor(amountMinor, from)
      : stored
  if (!Number.isFinite(rate) || rate <= 0) return `No rate for ${from} → ${to}`
  return rate >= 1
    ? `1 ${from} = ${rate.toFixed(RATE_DIGITS)} ${to}`
    : `1 ${to} = ${(1 / rate).toFixed(RATE_DIGITS)} ${from}`
}

export const receiveLabel = (to: TransferWallet): string =>
  `${to.name.toUpperCase()} RECEIVES`

export const overMessage = (from: TransferWallet): string =>
  `More than the ${formatMoney(from.balance, from.currency)} in ${from.name}.`

export function submitLabel(
  amountMinor: number | null,
  currency: CurrencyCode,
): string {
  return amountMinor !== null && amountMinor > 0
    ? `Transfer ${formatMoney(amountMinor, currency)}`
    : 'Enter an amount'
}

export type TransferDoneSummary = { title: string; sub: string }

export function doneSummary(
  from: TransferWallet,
  to: TransferWallet,
  amountMinor: number,
  receivedMinor: number,
): TransferDoneSummary {
  const fx =
    from.currency !== to.currency
      ? ` · received ${formatMoney(receivedMinor, to.currency)}`
      : ''
  return {
    title: `Transferred ${formatMoney(amountMinor, from.currency)}`,
    sub: `${from.name} → ${to.name}${fx}`,
  }
}
