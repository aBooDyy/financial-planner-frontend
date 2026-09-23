/**
 * Cross-feature derivation: transactions are the ledger, so wallet balances and goal saved
 * progress are computed from them (never stored twice). These pure helpers are shared by the
 * Balances and Goals views as well as the Spending views. All figures are minor units.
 */
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { LocalBalanceNode, LocalGoal, LocalTransaction } from '#/db/types'

type RatesMap = Partial<Record<string, number>>

const live = (txns: LocalTransaction[]): LocalTransaction[] =>
  txns.filter((t) => t.deleted === 0)

const signOf = (t: LocalTransaction): number =>
  t.type === 'income' || t.type === 'transfer_in' ? 1 : -1

const walletCurrencies = (
  nodes: LocalBalanceNode[],
): Map<string, CurrencyCode> => {
  const map = new Map<string, CurrencyCode>()
  for (const n of nodes) {
    if (n.kind === 'wallet') map.set(n.id, n.currency ?? 'SAR')
  }
  return map
}

/** Signed delta each transaction applies to its wallet, in the wallet's own currency. */
export function walletDeltas(
  nodes: LocalBalanceNode[],
  txns: LocalTransaction[],
  rates: RatesMap,
): Record<string, number> {
  const currencyOf = walletCurrencies(nodes)
  const out: Record<string, number> = {}
  for (const t of live(txns)) {
    const cur = currencyOf.get(t.walletId)
    if (!cur) continue
    out[t.walletId] =
      (out[t.walletId] ?? 0) +
      signOf(t) * convertMinor(t.amount, t.currency, cur, rates)
  }
  return out
}

/** Live balance per wallet (opening `amount` + transaction deltas), in the wallet's currency. */
export function walletLiveBalances(
  nodes: LocalBalanceNode[],
  txns: LocalTransaction[],
  rates: RatesMap,
): Record<string, number> {
  const deltas = walletDeltas(nodes, txns, rates)
  const out: Record<string, number> = {}
  for (const n of nodes) {
    if (n.kind === 'wallet') out[n.id] = (n.amount ?? 0) + (deltas[n.id] ?? 0)
  }
  return out
}

/**
 * Total contributed toward each goal, converted to that goal's currency. A goal-linked
 * transaction is money set aside, so its amount counts as progress regardless of type.
 */
export function contributionsByGoal(
  goals: LocalGoal[],
  txns: LocalTransaction[],
  rates: RatesMap,
): Record<string, number> {
  const currencyOf = new Map<string, CurrencyCode>(
    goals.map((g) => [g.id, g.currency]),
  )
  const out: Record<string, number> = {}
  for (const t of live(txns)) {
    if (!t.goalId) continue
    const cur = currencyOf.get(t.goalId)
    if (!cur) continue
    out[t.goalId] =
      (out[t.goalId] ?? 0) + convertMinor(t.amount, t.currency, cur, rates)
  }
  return out
}
