/**
 * Cross-feature derivation for goal allocations (sourced set-aside reserves). A goal's saved
 * progress and a wallet's reserved/available split both come from these — never stored twice.
 * All figures are minor units. Mirrors the spirit of `transactions/data/ledger.ts`.
 */
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type {
  LocalBalanceNode,
  LocalGoal,
  LocalGoalAllocation,
} from '#/db/types'

type RatesMap = Partial<Record<string, number>>

const live = (allocations: LocalGoalAllocation[]): LocalGoalAllocation[] =>
  allocations.filter((a) => a.deleted === 0)

/**
 * Total set aside toward each goal, in that goal's currency. Folded into the goal's saved
 * progress by `buildGoalsView`, alongside any goal-linked transaction contributions.
 */
export function allocationsByGoal(
  allocations: LocalGoalAllocation[],
  goals: LocalGoal[],
  rates: RatesMap,
): Record<string, number> {
  const currencyOf = new Map<string, CurrencyCode>(
    goals.map((g) => [g.id, g.currency]),
  )
  const out: Record<string, number> = {}
  for (const a of live(allocations)) {
    const cur = currencyOf.get(a.goalId)
    if (!cur) continue
    out[a.goalId] =
      (out[a.goalId] ?? 0) + convertMinor(a.amount, a.currency, cur, rates)
  }
  return out
}

// One goal's claim on a wallet's balance, in the wallet's own currency.
export type ReservationLine = {
  goalId: string
  goalName: string
  color: string
  amount: number
}

/**
 * Reserves earmarked against each wallet, grouped by wallet, in the wallet's currency. Only
 * `wallet`-sourced allocations whose wallet still exists count (a reserve whose wallet was
 * deleted survives as goal progress but reserves against nothing). Lines are largest first.
 */
export function walletReservations(
  allocations: LocalGoalAllocation[],
  goals: LocalGoal[],
  nodes: LocalBalanceNode[],
  rates: RatesMap,
): Record<string, ReservationLine[]> {
  const walletCurrency = new Map<string, CurrencyCode>()
  for (const n of nodes) {
    if (n.kind === 'wallet') walletCurrency.set(n.id, n.currency ?? 'SAR')
  }
  const goalById = new Map<string, LocalGoal>(goals.map((g) => [g.id, g]))

  const out: Record<string, ReservationLine[]> = {}
  for (const a of live(allocations)) {
    if (a.source !== 'wallet' || !a.walletId) continue
    const cur = walletCurrency.get(a.walletId)
    if (!cur) continue
    const goal = goalById.get(a.goalId)
    const line: ReservationLine = {
      goalId: a.goalId,
      goalName: goal?.name ?? 'Goal',
      color: goal?.color ?? '#64748B',
      amount: convertMinor(a.amount, a.currency, cur, rates),
    }
    ;(out[a.walletId] ??= []).push(line)
  }
  for (const lines of Object.values(out))
    lines.sort((a, b) => b.amount - a.amount)
  return out
}

/**
 * Total reserved against each wallet (wallet-sourced allocations only), in the wallet's own
 * currency. Used to warn when a new reserve would push a wallet past its balance. Not capped —
 * over-reserving is allowed and surfaces as a negative available balance.
 */
export function reservedByWallet(
  allocations: LocalGoalAllocation[],
  nodes: LocalBalanceNode[],
  rates: RatesMap,
): Record<string, number> {
  const walletCurrency = new Map<string, CurrencyCode>()
  for (const n of nodes) {
    if (n.kind === 'wallet') walletCurrency.set(n.id, n.currency ?? 'SAR')
  }
  const out: Record<string, number> = {}
  for (const a of live(allocations)) {
    if (a.source !== 'wallet' || !a.walletId) continue
    const cur = walletCurrency.get(a.walletId)
    if (!cur) continue
    out[a.walletId] =
      (out[a.walletId] ?? 0) + convertMinor(a.amount, a.currency, cur, rates)
  }
  return out
}
