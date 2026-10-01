import type { LocalGoal, LocalIncomeStream } from '#/db/types'
import type {
  CreateGoalWire,
  CreateIncomeWire,
  Goal,
  IncomeStream,
  IntervalUnit,
  IntervalUnitWire,
  ObligationFrequency,
  ObligationFrequencyWire,
  PlanWire,
  UpdateGoalWire,
  UpdateIncomeWire,
} from '#/features/goals/api/types'
import { toWireObligationFreq, toWireUnit } from '#/features/goals/api/types'

/** A repeat on the wire: the interval rides only with a custom frequency. */
export const repeatWire = (r: {
  frequency: ObligationFrequency | null
  customInterval: number | null
  customUnit: IntervalUnit | null
}): {
  frequency: ObligationFrequencyWire | null
  custom_interval: number | null
  custom_unit: IntervalUnitWire | null
} => {
  const custom = r.frequency === 'custom'
  return {
    frequency: r.frequency ? toWireObligationFreq(r.frequency) : null,
    custom_interval: custom ? r.customInterval : null,
    custom_unit: custom && r.customUnit ? toWireUnit(r.customUnit) : null,
  }
}

/** The stored plan's header, as every planning entity sends it. */
export const planWire = (l: {
  plannedAt: string | null
  planAmount: number | null
  planCount: number | null
  planStart: string | null
  setAsideDay: number | null
}): PlanWire => ({
  planned_at: l.plannedAt,
  plan_amount: l.planAmount,
  plan_count: l.planCount,
  plan_start: l.planStart,
  set_aside_day: l.setAsideDay,
})

// --- Income streams ------------------------------------------------------------------

/** Server income stream → local record (freshly synced: clean, not deleted). */
export const serverIncomeToLocal = (s: IncomeStream): LocalIncomeStream => ({
  ...s,
  dirty: 0,
  deleted: 0,
})

const incomeBody = (l: LocalIncomeStream): Omit<CreateIncomeWire, 'id'> => {
  const repeat = repeatWire(l)
  return {
    label: l.label,
    amount: l.amount,
    currency: l.currency,
    frequency: repeat.frequency ?? 'MONTHLY',
    custom_interval: repeat.custom_interval,
    custom_unit: repeat.custom_unit,
    day: l.day,
    anchor_date: l.anchorDate,
    ends_on: l.endsOn,
    color: l.color,
    position: l.position,
    wallet_id: l.walletId,
    category_id: l.categoryId,
    merchant_id: l.merchantId,
    autolog: l.autolog,
    note: l.note,
  }
}

export const localIncomeToCreateWire = (
  l: LocalIncomeStream,
): CreateIncomeWire => ({ id: l.id, ...incomeBody(l) })

// The update is based on the last-synced `version` (optimistic locking base).
export const localIncomeToUpdateWire = (
  l: LocalIncomeStream,
): UpdateIncomeWire => ({ version: l.version, ...incomeBody(l) })

// --- Goals ---------------------------------------------------------------------------

export const serverGoalToLocal = (g: Goal): LocalGoal => ({
  ...g,
  dirty: 0,
  deleted: 0,
})

const goalBody = (l: LocalGoal): Omit<CreateGoalWire, 'id'> => ({
  name: l.name,
  currency: l.currency,
  color: l.color,
  position: l.position,
  target: l.target,
  amount: l.amount,
  due_date: l.dueDate,
  must_have: l.mustHave,
  save_wallet_id: l.saveWalletId,
  use_category_id: l.useCategoryId,
  ...planWire(l),
})

export const localGoalToCreateWire = (l: LocalGoal): CreateGoalWire => ({
  id: l.id,
  ...goalBody(l),
})

export const localGoalToUpdateWire = (l: LocalGoal): UpdateGoalWire => ({
  version: l.version,
  ...goalBody(l),
})
