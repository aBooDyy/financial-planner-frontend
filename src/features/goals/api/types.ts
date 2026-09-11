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
  frequency: GoalFrequency | null
  nextDue: string | null
  dueDate: string | null
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
  frequency: GoalFrequencyWire | null
  next_due: string | null
  due_date: string | null
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
}

export type CreateGoalWire = {
  id: string
  kind: GoalKindWire
  name: string
  currency: string
  color: string
  position: number
  amount: number | null
  target: number | null
  saved: number
  frequency: GoalFrequencyWire | null
  next_due: string | null
  due_date: string | null
}

export type UpdateGoalWire = {
  version: string
  name: string
  currency: string
  color: string
  position: number
  amount: number | null
  target: number | null
  saved: number
  frequency: GoalFrequencyWire | null
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
}

// --- Mappers -------------------------------------------------------------------------

export const toIncome = (w: IncomeStreamWire): IncomeStream => ({
  id: w.id,
  label: w.label,
  amount: w.amount,
  currency: w.currency as CurrencyCode,
  frequency: fromWireFreq(w.frequency),
  day: w.day,
  color: w.color,
  position: w.position,
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
  currency: w.currency as CurrencyCode,
  note: w.note,
  position: w.position,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toGoal = (w: GoalWire): Goal => ({
  id: w.id,
  name: w.name,
  kind: fromWireKind(w.kind),
  currency: w.currency as CurrencyCode,
  color: w.color,
  position: w.position,
  amount: w.amount,
  target: w.target,
  saved: w.saved,
  frequency: w.frequency ? fromWireFreq(w.frequency) : null,
  nextDue: w.next_due,
  dueDate: w.due_date,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})
