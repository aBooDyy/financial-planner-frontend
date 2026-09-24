import { fromWireCurrency } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Lowercase inside the app, the backend's PersistedEnum UPPER_SNAKE name on the wire —
 * translated only here, at the boundary.
 */
export type PlannedOrigin = 'goal' | 'income' | 'recurring' | 'manual'
export type PlannedOriginWire = 'GOAL' | 'INCOME' | 'RECURRING' | 'MANUAL'

/** What confirming creates: a spend, a reservation, or an income entry. */
export type PlannedRole = 'payment' | 'set_aside' | 'income'
export type PlannedRoleWire = 'PAYMENT' | 'SET_ASIDE' | 'INCOME'

export type PlannedStatus = 'open' | 'done' | 'skipped'
export type PlannedStatusWire = 'OPEN' | 'DONE' | 'SKIPPED'

const ORIGIN_TO_WIRE: Record<PlannedOrigin, PlannedOriginWire> = {
  goal: 'GOAL',
  income: 'INCOME',
  recurring: 'RECURRING',
  manual: 'MANUAL',
}
const ORIGIN_FROM_WIRE: Record<PlannedOriginWire, PlannedOrigin> = {
  GOAL: 'goal',
  INCOME: 'income',
  RECURRING: 'recurring',
  MANUAL: 'manual',
}
const ROLE_TO_WIRE: Record<PlannedRole, PlannedRoleWire> = {
  payment: 'PAYMENT',
  set_aside: 'SET_ASIDE',
  income: 'INCOME',
}
const ROLE_FROM_WIRE: Record<PlannedRoleWire, PlannedRole> = {
  PAYMENT: 'payment',
  SET_ASIDE: 'set_aside',
  INCOME: 'income',
}
const STATUS_TO_WIRE: Record<PlannedStatus, PlannedStatusWire> = {
  open: 'OPEN',
  done: 'DONE',
  skipped: 'SKIPPED',
}
const STATUS_FROM_WIRE: Record<PlannedStatusWire, PlannedStatus> = {
  OPEN: 'open',
  DONE: 'done',
  SKIPPED: 'skipped',
}

export const toWireOrigin = (o: PlannedOrigin): PlannedOriginWire =>
  ORIGIN_TO_WIRE[o]
export const fromWireOrigin = (w: PlannedOriginWire): PlannedOrigin =>
  ORIGIN_FROM_WIRE[w]
export const toWireRole = (r: PlannedRole): PlannedRoleWire => ROLE_TO_WIRE[r]
export const fromWireRole = (w: PlannedRoleWire): PlannedRole =>
  ROLE_FROM_WIRE[w]
export const toWirePlannedStatus = (s: PlannedStatus): PlannedStatusWire =>
  STATUS_TO_WIRE[s]
export const fromWirePlannedStatus = (w: PlannedStatusWire): PlannedStatus =>
  STATUS_FROM_WIRE[w]

// --- Domain (camelCase) --------------------------------------------------------------

export type Planned = {
  id: string
  origin: PlannedOrigin
  role: PlannedRole
  goalId: string | null
  incomeStreamId: string | null
  recurringId: string | null
  walletId: string | null
  name: string
  amount: number
  currency: CurrencyCode
  category: string | null
  subcategory: string | null
  occurrence: string
  date: string
  status: PlannedStatus
  pinned: boolean
  note: string | null
  createdAt: string
  updatedAt: string
  version: string
}

// --- Wire (snake_case) ---------------------------------------------------------------

export type PlannedWire = {
  id: string
  origin: PlannedOriginWire
  role: PlannedRoleWire
  goal_id: string | null
  income_stream_id: string | null
  recurring_id: string | null
  wallet_id: string | null
  name: string
  amount: number
  currency: string
  category: string | null
  subcategory: string | null
  occurrence: string
  date: string
  status: PlannedStatusWire
  pinned: boolean
  note: string | null
  created_at: string
  updated_at: string
  version: string
}

export type CreatePlannedWire = Omit<
  PlannedWire,
  'created_at' | 'updated_at' | 'version'
>

/** `PATCH` carries every mutable field, so an omission never reads as "clear it". */
export type UpdatePlannedWire = {
  version: string
  amount: number
  date: string
  wallet_id: string | null
  status: PlannedStatusWire
  pinned: boolean
  note: string | null
  name: string
  category: string | null
  subcategory: string | null
}

/** One entry of `POST /planned-transactions/bulk`, answered in the order it was sent. */
export type BulkPlannedResultWire = {
  id: string
  status: 'CREATED' | 'ID_TAKEN' | 'INVALID'
  planned_transaction: PlannedWire | null
  error_code: string | null
  error_field: string | null
}

export type BulkCreatePlannedWire = {
  results: BulkPlannedResultWire[]
  created: number
  failed: number
}

export type BulkPlannedResult = {
  id: string
  /** `taken` — the id already exists: another device generated the same occurrence. */
  status: 'created' | 'taken' | 'invalid'
  /** The row as the server holds it; absent when the server did not send it back. */
  planned: Planned | null
}

// --- Mappers (wire → domain) ---------------------------------------------------------

export const toPlanned = (w: PlannedWire): Planned => ({
  id: w.id,
  origin: fromWireOrigin(w.origin),
  role: fromWireRole(w.role),
  goalId: w.goal_id,
  incomeStreamId: w.income_stream_id,
  recurringId: w.recurring_id,
  walletId: w.wallet_id,
  name: w.name,
  amount: w.amount,
  currency: fromWireCurrency(w.currency),
  category: w.category,
  subcategory: w.subcategory,
  occurrence: w.occurrence,
  date: w.date,
  status: fromWirePlannedStatus(w.status),
  pinned: w.pinned,
  note: w.note,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

const BULK_STATUS = {
  CREATED: 'created',
  ID_TAKEN: 'taken',
  INVALID: 'invalid',
} as const

export const toBulkPlannedResult = (
  w: BulkPlannedResultWire,
): BulkPlannedResult => ({
  id: w.id,
  status: BULK_STATUS[w.status],
  planned: w.planned_transaction ? toPlanned(w.planned_transaction) : null,
})
