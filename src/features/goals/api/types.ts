import { fromWireCurrency } from '#/lib/currency'
import { toSetAside } from '#/features/setAsides/api/types'
import type { CloseEffectWire, SetAside } from '#/features/setAsides/api/types'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Internal representation stays lowercase (nice for UI/logic); the wire is the backend's
 * PersistedEnum UPPER_SNAKE name. Translate only at the wire boundary (the mappers below).
 */
export type GoalFrequency =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semi'
  | 'annual'
export type GoalFrequencyWire =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI'
  | 'ANNUAL'

/**
 * A schedule repeats on a preset frequency or on a custom "every N days / weeks / months" —
 * bills and income streams alike (the backend's one `Frequency` enum).
 */
export type ObligationFrequency = GoalFrequency | 'custom'
export type ObligationFrequencyWire = GoalFrequencyWire | 'CUSTOM'

export type IntervalUnit = 'day' | 'week' | 'month'
export type IntervalUnitWire = 'DAY' | 'WEEK' | 'MONTH'

const FREQ_TO_WIRE: Record<GoalFrequency, GoalFrequencyWire> = {
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  semi: 'SEMI',
  annual: 'ANNUAL',
}
const FREQ_FROM_WIRE: Record<GoalFrequencyWire, GoalFrequency> = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  SEMI: 'semi',
  ANNUAL: 'annual',
}

const UNIT_TO_WIRE: Record<IntervalUnit, IntervalUnitWire> = {
  day: 'DAY',
  week: 'WEEK',
  month: 'MONTH',
}
const UNIT_FROM_WIRE: Record<IntervalUnitWire, IntervalUnit> = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
}

export const toWireFreq = (f: GoalFrequency): GoalFrequencyWire =>
  FREQ_TO_WIRE[f]
export const fromWireFreq = (w: GoalFrequencyWire): GoalFrequency =>
  FREQ_FROM_WIRE[w]
export const toWireObligationFreq = (
  f: ObligationFrequency,
): ObligationFrequencyWire => (f === 'custom' ? 'CUSTOM' : FREQ_TO_WIRE[f])
export const fromWireObligationFreq = (
  w: ObligationFrequencyWire,
): ObligationFrequency => (w === 'CUSTOM' ? 'custom' : FREQ_FROM_WIRE[w])
export const toWireUnit = (u: IntervalUnit): IntervalUnitWire => UNIT_TO_WIRE[u]
export const fromWireUnit = (w: IntervalUnitWire): IntervalUnit =>
  UNIT_FROM_WIRE[w]

// --- Domain types (camelCase) --------------------------------------------------------

export type IncomeStream = {
  id: string
  label: string
  amount: number
  currency: CurrencyCode
  frequency: ObligationFrequency
  /** "Every `customInterval` `customUnit`s" — set exactly when `frequency` is 'custom'. */
  customInterval: number | null
  customUnit: IntervalUnit | null
  day: number
  /** A known payday; non-monthly paydays step from it. */
  anchorDate: string | null
  /** The last payday; null pays forever. */
  endsOn: string | null
  color: string
  position: number
  walletId: string | null
  /** An income category (the client defaults it to Salary). */
  categoryId: string
  merchantId: string | null
  /** "Log it automatically when it arrives". */
  autolog: boolean
  note: string | null
  createdAt: string
  updatedAt: string
  version: string
}

/**
 * A goal's shape follows from which fields are set: target + date, target + monthly amount,
 * or a monthly amount alone. `amount` is required when there is no `dueDate`.
 */
export type Goal = {
  id: string
  name: string
  currency: CurrencyCode
  color: string
  position: number
  target: number | null
  /** Monthly amount. */
  amount: number | null
  dueDate: string | null
  mustHave: boolean
  saveWalletId: string | null
  /** The spend category "Use it" files under, remembered after the first time. */
  useCategoryId: string | null
  /** Set by Mark as done; cleared by Reopen. */
  closedAt: string | null
  /** Set by Pause; cleared by Resume and by Mark as done. */
  pausedAt: string | null
  plannedAt: string | null
  planAmount: number | null
  planCount: number | null
  planStart: string | null
  setAsideDay: number | null
  createdAt: string
  updatedAt: string
  version: string
}

// --- Wire types (snake_case) ---------------------------------------------------------

export type IncomeStreamWire = {
  id: string
  label: string
  amount: number
  currency: string
  frequency: ObligationFrequencyWire
  custom_interval?: number | null
  custom_unit?: IntervalUnitWire | null
  day: number
  anchor_date?: string | null
  ends_on?: string | null
  color: string
  position: number
  wallet_id?: string | null
  category_id: string
  merchant_id?: string | null
  autolog?: boolean
  note?: string | null
  created_at: string
  updated_at: string
  version: string
}

export type GoalWire = {
  id: string
  name: string
  currency: string
  color: string
  position: number
  target: number | null
  amount: number | null
  due_date: string | null
  must_have?: boolean
  save_wallet_id?: string | null
  use_category_id?: string | null
  closed_at?: string | null
  paused_at?: string | null
  planned_at?: string | null
  plan_amount?: number | null
  plan_count?: number | null
  plan_start?: string | null
  set_aside_day?: number | null
  created_at: string
  updated_at: string
  version: string
}

// Payloads sent to the backend (wire shape). PATCH is a full representation: an omitted
// nullable field is cleared, so every field goes on every update.

export type CreateIncomeWire = {
  id: string
  label: string
  amount: number
  currency: string
  frequency: ObligationFrequencyWire
  custom_interval: number | null
  custom_unit: IntervalUnitWire | null
  day: number
  anchor_date: string | null
  ends_on: string | null
  color: string
  position: number
  wallet_id: string | null
  category_id: string
  merchant_id: string | null
  autolog: boolean
  note: string | null
}

export type UpdateIncomeWire = Omit<CreateIncomeWire, 'id'> & {
  version: string
}

/** The stored plan's header and the set-aside day, sent on create and on update. */
export type PlanWire = {
  planned_at: string | null
  plan_amount: number | null
  plan_count: number | null
  plan_start: string | null
  set_aside_day: number | null
}

export type CreateGoalWire = PlanWire & {
  id: string
  name: string
  currency: string
  color: string
  position: number
  target: number | null
  amount: number | null
  due_date: string | null
  must_have: boolean
  save_wallet_id: string | null
  use_category_id: string | null
}

/** `closed_at` / `paused_at` are not in the contract: only the actions move them. */
export type UpdateGoalWire = Omit<CreateGoalWire, 'id'> & { version: string }

// --- Mappers -------------------------------------------------------------------------

export const toIncome = (w: IncomeStreamWire): IncomeStream => ({
  id: w.id,
  label: w.label,
  amount: w.amount,
  currency: fromWireCurrency(w.currency),
  frequency: fromWireObligationFreq(w.frequency),
  customInterval: w.custom_interval ?? null,
  customUnit: w.custom_unit ? fromWireUnit(w.custom_unit) : null,
  day: w.day,
  anchorDate: w.anchor_date ?? null,
  endsOn: w.ends_on ?? null,
  color: w.color,
  position: w.position,
  walletId: w.wallet_id ?? null,
  categoryId: w.category_id,
  merchantId: w.merchant_id ?? null,
  autolog: w.autolog ?? false,
  note: w.note ?? null,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toGoal = (w: GoalWire): Goal => ({
  id: w.id,
  name: w.name,
  currency: fromWireCurrency(w.currency),
  color: w.color,
  position: w.position,
  target: w.target,
  amount: w.amount,
  dueDate: w.due_date,
  mustHave: w.must_have ?? false,
  saveWalletId: w.save_wallet_id ?? null,
  useCategoryId: w.use_category_id ?? null,
  closedAt: w.closed_at ?? null,
  pausedAt: w.paused_at ?? null,
  plannedAt: w.planned_at ?? null,
  planAmount: w.plan_amount ?? null,
  planCount: w.plan_count ?? null,
  planStart: w.plan_start ?? null,
  setAsideDay: w.set_aside_day ?? null,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export type CloseGoalResultWire = CloseEffectWire & { goal: GoalWire }

export type CloseGoalResult = {
  goal: Goal
  released: SetAside[]
  created: SetAside[]
}

export const toCloseGoalResult = (w: CloseGoalResultWire): CloseGoalResult => ({
  goal: toGoal(w.goal),
  released: w.released.map(toSetAside),
  created: w.created.map(toSetAside),
})
