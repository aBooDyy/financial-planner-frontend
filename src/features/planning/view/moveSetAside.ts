/**
 * The Move and Fix sheets' arithmetic and copy: what is there to move, what an edited plan does
 * to its target wallets and to the wallet it leaves. Pure.
 */
import type { LocalBill, LocalGoal, LocalSetAside } from '#/db/types'
import { MoneyActionError } from '#/features/planning/actions/errors'
import type { MoveFrom } from '#/features/planning/stores/planningUi'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { overCommits } from './addMoney'
import type { OverCommit } from './addMoney'
import type { RebalanceMove } from './rebalance'

export type MoveSource = {
  ownerName: string
  walletId: string
  /** All that is there, in `currency`. */
  amount: number
  currency: CurrencyCode
  /** How many due dates the money is for; a goal's is 0. */
  dueDates: number
}

type MoveInputs = {
  setAsides: ReadonlyArray<LocalSetAside>
  bills: ReadonlyArray<Pick<LocalBill, 'id' | 'name' | 'currency'>>
  goals: ReadonlyArray<Pick<LocalGoal, 'id' | 'name' | 'currency'>>
  rates: RatesMap
}

const isInWallet = (a: LocalSetAside): boolean =>
  isLiveSetAside(a) && a.source === 'wallet' && a.walletId !== null

/** What `from` has to move right now; null once none of it is there. */
export function moveSourceOf(
  from: MoveFrom,
  inputs: MoveInputs,
): MoveSource | null {
  if (from.kind === 'row') {
    const row = inputs.setAsides.find((a) => a.id === from.id)
    if (!row || !isInWallet(row)) return null
    const owner = row.goalId
      ? inputs.goals.find((g) => g.id === row.goalId)
      : inputs.bills.find((b) => b.id === row.billId)
    return {
      ownerName: owner?.name ?? 'this',
      walletId: row.walletId as string,
      amount: row.amount,
      currency: row.currency,
      dueDates: row.occurrence ? 1 : 0,
    }
  }
  const owner =
    from.owner.kind === 'goal'
      ? inputs.goals.find((g) => g.id === from.owner.id)
      : inputs.bills.find((b) => b.id === from.owner.id)
  if (!owner) return null
  const rows = inputs.setAsides.filter(
    (a) =>
      isInWallet(a) &&
      a.walletId === from.walletId &&
      (from.owner.kind === 'goal' ? a.goalId : a.billId) === from.owner.id,
  )
  if (rows.length === 0) return null
  return {
    ownerName: owner.name,
    walletId: from.walletId,
    amount: rows.reduce(
      (sum, a) =>
        sum + convertMinor(a.amount, a.currency, owner.currency, inputs.rates),
      0,
    ),
    currency: owner.currency,
    dueDates: new Set(rows.flatMap((a) => a.occurrence ?? [])).size,
  }
}

/** The target wallets a plan's moves would push past their free money, each summed once. */
export function planOverCommits(
  moves: ReadonlyArray<RebalanceMove>,
  wallets: ReadonlyMap<string, { free: number; currency: CurrencyCode }>,
  rates: RatesMap,
): OverCommit[] {
  const landed = new Map<string, number>()
  for (const move of moves) {
    const wallet = wallets.get(move.toWalletId)
    if (!wallet) continue
    landed.set(
      move.toWalletId,
      (landed.get(move.toWalletId) ?? 0) +
        convertMinor(move.amount, move.currency, wallet.currency, rates),
    )
  }
  return [...landed].flatMap(([walletId, amount]) =>
    overCommits(
      [{ walletId, amount }],
      (wallets.get(walletId) as { currency: CurrencyCode }).currency,
      wallets,
      rates,
    ),
  )
}

/** How much a plan takes off the wallet it leaves, in `currency`: each row is measured whole. */
export function reliefOf(
  moves: ReadonlyArray<RebalanceMove>,
  rows: ReadonlyArray<LocalSetAside>,
  currency: CurrencyCode,
  rates: RatesMap,
): number {
  const moved = new Map<string, number>()
  for (const move of moves)
    moved.set(move.setAsideId, (moved.get(move.setAsideId) ?? 0) + move.amount)
  let relief = 0
  for (const row of rows) {
    const amount = moved.get(row.id)
    if (amount === undefined) continue
    relief +=
      convertMinor(row.amount, row.currency, currency, rates) -
      convertMinor(row.amount - amount, row.currency, currency, rates)
  }
  return relief
}

/** Why a move was refused, in words. */
export function moveErrorText(error: unknown): string {
  if (error instanceof MoneyActionError) {
    switch (error.code) {
      case 'no_wallet':
        return 'That wallet can’t take it. It may have been archived. Pick another one.'
      case 'not_found':
        return 'This set-aside has changed since you opened this. Close it and try again.'
      case 'bad_amount':
        return 'That amount can’t be moved. It’s more than is there, or too small to exist in that wallet’s currency, or there’s no exchange rate for it.'
    }
  }
  return 'That didn’t go through. Close this, check your wallets and try again.'
}
