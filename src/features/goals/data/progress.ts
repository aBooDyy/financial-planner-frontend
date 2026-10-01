/**
 * How far each goal has come: its live set-asides plus what was already used (spent) from it.
 * Spending from a goal releases the set-asides it used explicitly, so the two never overlap.
 */
import type { LocalGoal, LocalSetAside, LocalTransaction } from '#/db/types'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { convertMinor } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'

export type GoalProgress = {
  /** Σ live set-asides, in the goal's currency. */
  setAside: number
  /** Σ spending linked to the goal, in the goal's currency. */
  used: number
  /** `setAside + used`. */
  progress: number
  /** `setAside` per wallet it sits in. */
  byWallet: Partial<Record<string, number>>
  /** `setAside` held outside any wallet. */
  outside: number
}

/** Keyed by goal id; a goal missing from the input is missing here. */
export type GoalProgressMap = Partial<Record<string, GoalProgress>>

export function goalProgress(
  goals: ReadonlyArray<LocalGoal>,
  setAsides: ReadonlyArray<LocalSetAside>,
  txns: ReadonlyArray<LocalTransaction>,
  rates: RatesMap,
): GoalProgressMap {
  const out: GoalProgressMap = {}
  for (const g of goals) {
    const inGoal = (amount: number, currency: string) =>
      convertMinor(amount, currency, g.currency, rates)
    const byWallet: Partial<Record<string, number>> = {}
    let setAside = 0
    let outside = 0
    for (const a of setAsides) {
      if (a.goalId !== g.id || !isLiveSetAside(a)) continue
      const amount = inGoal(a.amount, a.currency)
      setAside += amount
      if (a.source === 'wallet' && a.walletId)
        byWallet[a.walletId] = (byWallet[a.walletId] ?? 0) + amount
      else outside += amount
    }
    const used = txns
      .filter((t) => t.deleted === 0 && t.goalId === g.id && t.type === 'spend')
      .reduce((sum, t) => sum + inGoal(t.amount, t.currency), 0)
    out[g.id] = {
      setAside,
      used,
      progress: setAside + used,
      byWallet,
      outside,
    }
  }
  return out
}

/** Just the progress figure per goal — what the funding engine counts as saved. */
export const progressByGoal = (
  progress: GoalProgressMap,
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(progress).map(([id, p]) => [id, p?.progress ?? 0]),
  )
