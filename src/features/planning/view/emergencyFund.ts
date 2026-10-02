import type { LocalBill, LocalGoal } from '#/db/types'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import { convertMinor, toMajor, toMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import type { GoalPreset } from '#/features/planning/stores/planningUi'

/** Months of must-pay bills an emergency fund should hold. */
export const EMERGENCY_MONTHS = 3

/** What the open must-pay bills that repeat cost a month, in base. */
export function monthlyMustPay(
  bills: ReadonlyArray<LocalBill>,
  base: CurrencyCode,
  rates: RatesMap,
): number {
  return bills
    .filter((b) => b.closedAt === null && b.mustPay && b.frequency !== null)
    .reduce(
      (sum, b) =>
        sum +
        (convertMinor(b.amount, b.currency, base, rates) *
          frequencyMetaOf(b, 'monthly').perYear) /
          12,
      0,
    )
}

/**
 * The one-tap Emergency fund (04 §3): offered while the user has no open goal, a must-have
 * goal holding three months of must-pay bills (no target when there are none yet).
 */
export function emergencyFundPreset(
  goals: ReadonlyArray<LocalGoal>,
  bills: ReadonlyArray<LocalBill>,
  base: CurrencyCode,
  rates: RatesMap,
): GoalPreset | null {
  if (goals.some((g) => g.closedAt === null)) return null
  const monthly = monthlyMustPay(bills, base, rates)
  const target =
    monthly > 0
      ? toMinor(Math.ceil(toMajor(monthly * EMERGENCY_MONTHS, base)), base)
      : null
  return { name: 'Emergency fund', target, amount: null, mustHave: true }
}
