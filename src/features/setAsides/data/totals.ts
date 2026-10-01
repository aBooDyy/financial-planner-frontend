/**
 * Pure sums over set-asides. Every figure follows from the live rows alone: a set-aside is a
 * label on money in its wallet, released explicitly, so nothing here re-derives what a payment
 * consumed.
 */
import type {
  LocalBalanceNode,
  LocalBill,
  LocalGoal,
  LocalSetAside,
} from '#/db/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'

/** Live: still earmarking money. Released rows stay as history. */
export const isLiveSetAside = (
  a: Pick<LocalSetAside, 'releasedAt' | 'deleted'>,
): boolean => a.deleted === 0 && a.releasedAt === null

/** One bill's or goal's set-aside in a wallet, in the wallet's currency. */
export type WalletSetAsideLine = {
  ownerId: string
  owner: 'goal' | 'bill'
  ownerName: string
  color: string
  amount: number
}

type Owner = { owner: 'goal' | 'bill'; name: string; color: string }

/**
 * What each wallet holds set aside, per bill and goal, largest first. Only live `wallet`
 * set-asides count, and only in a wallet that still exists.
 */
export function walletSetAsides(
  setAsides: ReadonlyArray<LocalSetAside>,
  goals: ReadonlyArray<Pick<LocalGoal, 'id' | 'name' | 'color'>>,
  bills: ReadonlyArray<Pick<LocalBill, 'id' | 'name' | 'color'>>,
  nodes: ReadonlyArray<LocalBalanceNode>,
  rates: RatesMap,
): Record<string, WalletSetAsideLine[]> {
  const walletCurrency = new Map<string, CurrencyCode>()
  for (const n of nodes) {
    if (n.kind === 'wallet' && n.deleted === 0)
      walletCurrency.set(n.id, n.currency ?? 'SAR')
  }
  const owners = new Map<string, Owner>([
    ...goals.map((g): [string, Owner] => [
      g.id,
      { owner: 'goal', name: g.name, color: g.color },
    ]),
    ...bills.map((b): [string, Owner] => [
      b.id,
      { owner: 'bill', name: b.name, color: b.color },
    ]),
  ])

  const held = new Map<string, number>()
  for (const a of setAsides) {
    if (!isLiveSetAside(a) || a.source !== 'wallet' || !a.walletId) continue
    const currency = walletCurrency.get(a.walletId)
    const ownerId = a.goalId ?? a.billId
    if (!currency || !ownerId || !owners.has(ownerId)) continue
    const key = `${a.walletId}|${ownerId}`
    held.set(
      key,
      (held.get(key) ?? 0) +
        convertMinor(a.amount, a.currency, currency, rates),
    )
  }

  const out: Record<string, WalletSetAsideLine[]> = {}
  for (const [key, amount] of held) {
    if (amount <= 0) continue
    const [walletId, ownerId] = key.split('|')
    const owner = owners.get(ownerId) as Owner
    ;(out[walletId] ??= []).push({
      ownerId,
      owner: owner.owner,
      ownerName: owner.name,
      color: owner.color,
      amount,
    })
  }
  for (const lines of Object.values(out))
    lines.sort((a, b) => b.amount - a.amount)
  return out
}

/** Σ live set-asides of one bill or goal, in `currency`. */
export function setAsideFor(
  ownerId: string,
  setAsides: ReadonlyArray<LocalSetAside>,
  currency: CurrencyCode,
  rates: RatesMap,
): number {
  return setAsides
    .filter(
      (a) =>
        isLiveSetAside(a) && (a.goalId === ownerId || a.billId === ownerId),
    )
    .reduce(
      (sum, a) => sum + convertMinor(a.amount, a.currency, currency, rates),
      0,
    )
}
