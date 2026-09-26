import { fromWireCurrency } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Internal representation stays lowercase (nice for UI/logic); the wire is the backend's
 * PersistedEnum UPPER_SNAKE name. Translate only at the wire boundary (toGoal / create wire).
 */
export type GoalKind = 'onetime' | 'recurring' | 'openended' | 'sinking'
export type GoalKindWire = 'ONETIME' | 'RECURRING' | 'OPENENDED' | 'SINKING'

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

/** A goal repeats on a preset frequency or on a custom "every N days / weeks / months". */
export type ObligationFrequency = GoalFrequency | 'custom'
export type ObligationFrequencyWire = GoalFrequencyWire | 'CUSTOM'

export type IntervalUnit = 'day' | 'week' | 'month'
export type IntervalUnitWire = 'DAY' | 'WEEK' | 'MONTH'

const KIND_TO_WIRE: Record<GoalKind, GoalKindWire> = {
  onetime: 'ONETIME',
  recurring: 'RECURRING',
  openended: 'OPENENDED',
  sinking: 'SINKING',
}
const KIND_FROM_WIRE: Record<GoalKindWire, GoalKind> = {
  ONETIME: 'onetime',
  RECURRING: 'recurring',
  OPENENDED: 'openended',
  SINKING: 'sinking',
}
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

export type AllocationSource = 'wallet' | 'external'
export type AllocationSourceWire = 'WALLET' | 'EXTERNAL'

const SOURCE_TO_WIRE: Record<AllocationSource, AllocationSourceWire> = {
  wallet: 'WALLET',
  external: 'EXTERNAL',
}
const SOURCE_FROM_WIRE: Record<AllocationSourceWire, AllocationSource> = {
  WALLET: 'wallet',
  EXTERNAL: 'external',
}

export const toWireSource = (s: AllocationSource): AllocationSourceWire =>
  SOURCE_TO_WIRE[s]
export const fromWireSource = (w: AllocationSourceWire): AllocationSource =>
  SOURCE_FROM_WIRE[w]

export const toWireKind = (kind: GoalKind): GoalKindWire => KIND_TO_WIRE[kind]
export const fromWireKind = (wire: GoalKindWire): GoalKind =>
  KIND_FROM_WIRE[wire]
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
  frequency: GoalFrequency
  day: number
  color: string
  position: number
  walletId: string | null
  anchorDate: string | null
  createdAt: string
  updatedAt: string
  version: string
}

export type Goal = {
  id: string
  name: string
  kind: GoalKind
  currency: CurrencyCode
  color: string
  position: number
  // Minor units. `amount` = per-cycle or monthly contribution; `target` = total to reach;
  // `saved` = already set aside. Which apply depends on the kind.
  amount: number | null
  target: number | null
  saved: number
  frequency: ObligationFrequency | null
  // "Every `customInterval` `customUnit`s" — set only when `frequency` is 'custom'.
  customInterval: number | null
  customUnit: IntervalUnit | null
  nextDue: string | null
  dueDate: string | null
  plannedAt: string | null
  planAmount: number | null
  planCount: number | null
  planStart: string | null
  setAsideDay: number | null
  payOnDue: boolean
  createdAt: string
  updatedAt: string
  version: string
}

export type GoalAllocation = {
  id: string
  goalId: string
  source: AllocationSource
  walletId: string | null
  externalLabel: string | null
  amount: number
  currency: CurrencyCode
  note: string | null
  position: number
  date: string
  plannedId: string | null
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
  frequency: GoalFrequencyWire
  day: number
  color: string
  position: number
  wallet_id?: string | null
  anchor_date?: string | null
  created_at: string
  updated_at: string
  version: string
}

export type GoalWire = {
  id: string
  kind: GoalKindWire
  name: string
  currency: string
  color: string
  position: number
  amount: number | null
  target: number | null
  saved: number
  frequency: ObligationFrequencyWire | null
  custom_interval?: number | null
  custom_unit?: IntervalUnitWire | null
  next_due: string | null
  due_date: string | null
  planned_at?: string | null
  plan_amount?: number | null
  plan_count?: number | null
  plan_start?: string | null
  set_aside_day?: number | null
  pay_on_due?: boolean
  created_at: string
  updated_at: string
  version: string
}

export type GoalAllocationWire = {
  id: string
  goal_id: string
  source: AllocationSourceWire
  wallet_id: string | null
  external_label: string | null
  amount: number
  currency: string
  note: string | null
  position: number
  date?: string | null
  planned_id?: string | null
  created_at: string
  updated_at: string
  version: string
}

// Payloads sent to the backend (wire shape).
export type CreateIncomeWire = {
  id: string
  label: string
  amount: number
  currency: string
  frequency: GoalFrequencyWire
  day: number
  color: string
  position: number
  wallet_id: string | null
  anchor_date: string | null
}

export type UpdateIncomeWire = {
  version: string
  label: string
  amount: number
  currency: string
  frequency: GoalFrequencyWire
  day: number
  color: string
  position: number
  wallet_id: string | null
  anchor_date: string | null
}

/** The stored plan's header and the planning knobs, sent on create and on update. */
export type GoalPlanWire = {
  planned_at: string | null
  plan_amount: number | null
  plan_count: number | null
  plan_start: string | null
  set_aside_day: number | null
  pay_on_due: boolean
}

export type CreateGoalWire = GoalPlanWire & {
  id: string
  kind: GoalKindWire
  name: string
  currency: string
  color: string
  position: number
  amount: number | null
  target: number | null
  saved: number
  frequency: ObligationFrequencyWire | null
  custom_interval: number | null
  custom_unit: IntervalUnitWire | null
  next_due: string | null
  due_date: string | null
}

export type UpdateGoalWire = GoalPlanWire & {
  version: string
  name: string
  currency: string
  color: string
  position: number
  amount: number | null
  target: number | null
  saved: number
  frequency: ObligationFrequencyWire | null
  custom_interval: number | null
  custom_unit: IntervalUnitWire | null
  next_due: string | null
  due_date: string | null
}

export type CreateGoalAllocationWire = {
  id: string
  goal_id: string
  source: AllocationSourceWire
  wallet_id: string | null
  external_label: string | null
  amount: number
  currency: string
  note: string | null
  position: number
  date: string
  planned_id: string | null
}

export type UpdateGoalAllocationWire = {
  version: string
  source: AllocationSourceWire
  wallet_id: string | null
  external_label: string | null
  amount: number
  currency: string
  note: string | null
  position: number
  date: string
  planned_id: string | null
}

// --- Mappers -------------------------------------------------------------------------

export const toIncome = (w: IncomeStreamWire): IncomeStream => ({
  id: w.id,
  label: w.label,
  amount: w.amount,
  currency: fromWireCurrency(w.currency),
  frequency: fromWireFreq(w.frequency),
  day: w.day,
  color: w.color,
  position: w.position,
  walletId: w.wallet_id ?? null,
  anchorDate: w.anchor_date ?? null,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toAllocation = (w: GoalAllocationWire): GoalAllocation => ({
  id: w.id,
  goalId: w.goal_id,
  source: fromWireSource(w.source),
  walletId: w.wallet_id,
  externalLabel: w.external_label,
  amount: w.amount,
  currency: fromWireCurrency(w.currency),
  note: w.note,
  position: w.position,
  date: w.date ?? w.created_at.slice(0, 10),
  plannedId: w.planned_id ?? null,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toGoal = (w: GoalWire): Goal => ({
  id: w.id,
  name: w.name,
  kind: fromWireKind(w.kind),
  currency: fromWireCurrency(w.currency),
  color: w.color,
  position: w.position,
  amount: w.amount,
  target: w.target,
  saved: w.saved,
  frequency: w.frequency ? fromWireObligationFreq(w.frequency) : null,
  customInterval: w.custom_interval ?? null,
  customUnit: w.custom_unit ? fromWireUnit(w.custom_unit) : null,
  nextDue: w.next_due,
  dueDate: w.due_date,
  plannedAt: w.planned_at ?? null,
  planAmount: w.plan_amount ?? null,
  planCount: w.plan_count ?? null,
  planStart: w.plan_start ?? null,
  setAsideDay: w.set_aside_day ?? null,
  payOnDue: w.pay_on_due ?? false,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})
