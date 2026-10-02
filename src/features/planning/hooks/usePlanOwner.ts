import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type { LocalBill, LocalGoal } from '#/db/types'
import type { PlanOwner } from '#/features/planned/data/owners'
import type { CurrencyCode } from '#/lib/currency'

export type OwnerInfo =
  | { kind: 'bill'; bill: LocalBill; name: string; currency: CurrencyCode }
  | { kind: 'goal'; goal: LocalGoal; name: string; currency: CurrencyCode }

/** The bill or goal a sheet acts on, or null once it is gone (or none is picked yet). */
export function usePlanOwner(owner: PlanOwner | null): OwnerInfo | null {
  const { inputs } = usePlannedData()
  if (!owner) return null
  if (owner.kind === 'bill') {
    const bill = inputs.bills.find((b) => b.id === owner.id)
    return bill
      ? { kind: 'bill', bill, name: bill.name, currency: bill.currency }
      : null
  }
  const goal = inputs.goals.find((g) => g.id === owner.id)
  return goal
    ? { kind: 'goal', goal, name: goal.name, currency: goal.currency }
    : null
}
