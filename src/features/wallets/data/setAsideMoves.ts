/**
 * Money that is set aside moving with — or out from under — its wallet (03 §6): a transfer of
 * more than a wallet's Free to spend, a balance adjustment below its set-asides, archiving or
 * deleting a wallet that holds some. Which set-asides are touched and the words for it. Pure.
 */
import type { LocalSetAside } from '#/db/types'
import type { SetAsidePart } from '#/features/setAsides/data/batches'
import type { WalletSetAsideLine } from '#/features/setAsides/data/totals'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor, formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/** Part of one bill's or goal's set-aside in a wallet, in the wallet's currency. */
export type HeldPick = Pick<
  WalletSetAsideLine,
  'ownerId' | 'owner' | 'ownerName'
> & { amount: number }

/**
 * How much of `amount` taken out of a wallet is set-aside money: whatever goes beyond its Free
 * to spend, never more than it holds set aside.
 */
export function setAsideShare(
  balance: number,
  setAside: number,
  amount: number,
): number {
  const free = Math.max(0, balance - setAside)
  return Math.min(setAside, Math.max(0, amount - free))
}

/** Which set-asides a share comes out of: the wallet's lines, largest first. */
export function pickHeld(
  lines: ReadonlyArray<WalletSetAsideLine>,
  share: number,
): HeldPick[] {
  const picks: HeldPick[] = []
  let left = share
  for (const line of [...lines].sort((a, b) => b.amount - a.amount)) {
    if (left <= 0) break
    const amount = Math.min(line.amount, left)
    if (amount <= 0) continue
    picks.push({
      ownerId: line.ownerId,
      owner: line.owner,
      ownerName: line.ownerName,
      amount,
    })
    left -= amount
  }
  return picks
}

const ownerOf = (a: LocalSetAside): string | null => a.goalId ?? a.billId

/** Live set-asides held in any of these wallets. */
export function heldIn(
  rows: ReadonlyArray<LocalSetAside>,
  walletIds: ReadonlySet<string>,
): LocalSetAside[] {
  return rows.filter(
    (a) =>
      isLiveSetAside(a) &&
      a.source === 'wallet' &&
      a.walletId !== null &&
      walletIds.has(a.walletId),
  )
}

/** "SR 1,900.00": what these wallets hold set aside, in base — null when nothing. */
export function heldTotalStr(
  rows: ReadonlyArray<LocalSetAside>,
  walletIds: ReadonlySet<string>,
  base: CurrencyCode,
  rates: RatesMap,
): string | null {
  const held = heldIn(rows, walletIds)
  if (held.length === 0) return null
  const total = held.reduce(
    (sum, a) => sum + convertMinor(a.amount, a.currency, base, rates),
    0,
  )
  return formatMoney(total, base)
}

/**
 * The live rows behind the picks — each owner's in the wallet, oldest first, the last one cut
 * to what is left — as the parts a move or release acts on (amounts in each row's currency).
 */
export function partsForPicks(
  rows: ReadonlyArray<LocalSetAside>,
  walletId: string,
  walletCurrency: CurrencyCode,
  picks: ReadonlyArray<HeldPick>,
  rates: RatesMap,
): SetAsidePart[] {
  const inWallet = heldIn(rows, new Set([walletId])).sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  )
  const parts: SetAsidePart[] = []
  for (const pick of picks) {
    let left = pick.amount
    for (const row of inWallet) {
      if (left <= 0) break
      if (ownerOf(row) !== pick.ownerId) continue
      const want = convertMinor(left, walletCurrency, row.currency, rates)
      const take = Math.min(row.amount, want)
      if (take <= 0) continue
      parts.push(
        take >= row.amount ? { id: row.id } : { id: row.id, amount: take },
      )
      left -= convertMinor(take, row.currency, walletCurrency, rates)
    }
  }
  return parts
}

/** "Car insurance SR 300.00, Umrah SR 100.00". */
export const picksText = (
  picks: ReadonlyArray<HeldPick>,
  currency: CurrencyCode,
): string =>
  picks
    .map((p) => `${p.ownerName} ${formatMoney(p.amount, currency)}`)
    .join(', ')

/** The transfer prompt: "SR 400.00 of this is set aside (Car insurance SR 300.00, …)." */
export function transferPromptText(
  share: number,
  picks: ReadonlyArray<HeldPick>,
  currency: CurrencyCode,
): string {
  return `${formatMoney(share, currency)} of this is set aside (${picksText(picks, currency)}). Move those set-asides with it?`
}

/**
 * The adjustment warning, when the new balance is below what the wallet holds set aside —
 * null otherwise.
 */
export function adjustWarning(
  walletName: string,
  next: number,
  setAside: number,
  currency: CurrencyCode,
): string | null {
  if (setAside <= 0 || next >= setAside) return null
  return `${walletName} holds ${formatMoney(setAside, currency)} set aside. At ${formatMoney(next, currency)} it would be ${formatMoney(setAside - next, currency)} over-committed.`
}
