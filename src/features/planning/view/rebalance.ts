/**
 * What to move off an over-committed wallet, and where: labels only, no real money moves. The
 * furthest-due money goes first (what is due soon is the most likely to be spent from this
 * wallet), into the wallets with the most free money. Pure.
 */
import type { LocalBill, LocalGoal, LocalSetAside } from '#/db/types'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

export type RebalanceMove = {
  setAsideId: string
  ownerKind: 'bill' | 'goal'
  ownerName: string
  occurrence: string | null
  toWalletId: string
  /** In the set-aside's own currency; may be part of the row. */
  amount: number
  currency: CurrencyCode
}

export type RebalancePlan = {
  walletId: string
  /** What the wallet is over by, wallet currency. 0 when it is not over. */
  over: number
  moves: RebalanceMove[]
  /** What no other wallet has room for, wallet currency. 0 when fully covered. */
  shortBy: number
}

type RebalanceWallet = {
  walletId: string
  free: number
  currency: CurrencyCode
}

/** Goals have no due date, so they come first; then bills, the latest occurrence first. */
function furthestDueFirst(a: LocalSetAside, b: LocalSetAside): number {
  const aOccurrence = a.goalId ? null : a.occurrence
  const bOccurrence = b.goalId ? null : b.occurrence
  if (aOccurrence !== bOccurrence) {
    if (aOccurrence === null) return -1
    if (bOccurrence === null) return 1
    return bOccurrence.localeCompare(aOccurrence)
  }
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
}

/** The smallest of 1…`max` for which `holds`, which never turns false as the number grows. */
function smallestWhere(
  max: number,
  holds: (x: number) => boolean,
): number | null {
  if (max < 1 || !holds(max)) return null
  let low = 1
  let high = max
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (holds(middle)) high = middle
    else low = middle + 1
  }
  return low
}

export function suggestRebalance(args: {
  walletId: string
  wallets: ReadonlyArray<RebalanceWallet>
  setAsides: ReadonlyArray<LocalSetAside>
  bills: ReadonlyArray<Pick<LocalBill, 'id' | 'name'>>
  goals: ReadonlyArray<Pick<LocalGoal, 'id' | 'name'>>
  rates: RatesMap
}): RebalancePlan {
  const { walletId, rates } = args
  const source = args.wallets.find((w) => w.walletId === walletId)
  const over = source ? Math.max(0, -source.free) : 0
  const plan: RebalancePlan = { walletId, over, moves: [], shortBy: 0 }
  if (!source || over === 0) return plan

  const inSource = (amount: number, from: CurrencyCode) =>
    convertMinor(amount, from, source.currency, rates)
  const targets = args.wallets
    .filter((w) => w.walletId !== walletId && w.free > 0)
    .map((w) => ({ ...w, comparable: inSource(w.free, w.currency) }))
    .filter((w) => w.comparable > 0)
    .sort((a, b) => b.comparable - a.comparable)
    .map((w) => ({ walletId: w.walletId, currency: w.currency, room: w.free }))

  const goalNames = new Map(args.goals.map((g) => [g.id, g.name]))
  const billNames = new Map(args.bills.map((b) => [b.id, b.name]))
  const ownerNameOf = (row: LocalSetAside) =>
    row.goalId ? goalNames.get(row.goalId) : billNames.get(row.billId ?? '')

  const rows = args.setAsides
    .filter(
      (a) =>
        isLiveSetAside(a) &&
        a.source === 'wallet' &&
        a.walletId === walletId &&
        ownerNameOf(a) !== undefined,
    )
    .sort(furthestDueFirst)

  let left = over
  for (const row of rows) {
    let rest = row.amount
    for (const target of targets) {
      if (left <= 0 || rest <= 0) break
      // Rounding is measured, not assumed: the wallet's Set aside adds each row up on its own.
      const relief = (x: number) =>
        inSource(rest, row.currency) - inSource(rest - x, row.currency)
      const landed = (x: number) =>
        convertMinor(x, row.currency, target.currency, rates)
      const fewestLanding = smallestWhere(rest, (x) => landed(x) > 0)
      if (fewestLanding === null) continue
      const tooMany = smallestWhere(rest, (x) => landed(x) > target.room)
      const most = tooMany === null ? rest : tooMany - 1
      if (fewestLanding > most) continue
      const covers = smallestWhere(rest, (x) => relief(x) >= left) ?? rest
      const amount = Math.max(fewestLanding, Math.min(covers, most))
      const relieved = relief(amount)
      if (relieved <= 0) continue
      plan.moves.push({
        setAsideId: row.id,
        ownerKind: row.goalId ? 'goal' : 'bill',
        ownerName: ownerNameOf(row) as string,
        occurrence: row.occurrence,
        toWalletId: target.walletId,
        amount,
        currency: row.currency,
      })
      target.room -= landed(amount)
      left -= relieved
      rest -= amount
    }
  }
  plan.shortBy = Math.max(0, left)
  return plan
}
