import { fromWireCurrency, fromWireCurrencyOrNull } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

// Internal representation stays lowercase (nice for UI/logic); the wire is the backend's
// PersistedEnum UPPER_SNAKE name. Translate only at the wire boundary (toNode / create wire).
export type NodeKind = 'wallet' | 'group'
export type NodeKindWire = 'WALLET' | 'GROUP'

const KIND_TO_WIRE: Record<NodeKind, NodeKindWire> = {
  wallet: 'WALLET',
  group: 'GROUP',
}
const KIND_FROM_WIRE: Record<NodeKindWire, NodeKind> = {
  WALLET: 'wallet',
  GROUP: 'group',
}

export const toWireKind = (kind: NodeKind): NodeKindWire => KIND_TO_WIRE[kind]
export const fromWireKind = (wire: NodeKindWire): NodeKind =>
  KIND_FROM_WIRE[wire]

/** How far ahead Safe to spend looks: to the next main payday, month end, or N days. */
export type SafeHorizon = 'until_payday' | 'end_of_month' | 'days'
export type SafeHorizonWire = 'UNTIL_PAYDAY' | 'END_OF_MONTH' | 'DAYS'
/** Whether payday set-asides wait in a review queue or are made without a tap. */
export type PaydayMode = 'review' | 'auto'
export type PaydayModeWire = 'REVIEW' | 'AUTO'

const HORIZON_TO_WIRE: Record<SafeHorizon, SafeHorizonWire> = {
  until_payday: 'UNTIL_PAYDAY',
  end_of_month: 'END_OF_MONTH',
  days: 'DAYS',
}
const HORIZON_FROM_WIRE: Record<SafeHorizonWire, SafeHorizon> = {
  UNTIL_PAYDAY: 'until_payday',
  END_OF_MONTH: 'end_of_month',
  DAYS: 'days',
}
const PAYDAY_TO_WIRE: Record<PaydayMode, PaydayModeWire> = {
  review: 'REVIEW',
  auto: 'AUTO',
}
const PAYDAY_FROM_WIRE: Record<PaydayModeWire, PaydayMode> = {
  REVIEW: 'review',
  AUTO: 'auto',
}

export const toWireHorizon = (h: SafeHorizon): SafeHorizonWire =>
  HORIZON_TO_WIRE[h]
export const fromWireHorizon = (w: SafeHorizonWire): SafeHorizon =>
  HORIZON_FROM_WIRE[w]
export const toWirePaydayMode = (m: PaydayMode): PaydayModeWire =>
  PAYDAY_TO_WIRE[m]
export const fromWirePaydayMode = (w: PaydayModeWire): PaydayMode =>
  PAYDAY_FROM_WIRE[w]

// --- Domain types (camelCase) --------------------------------------------------------

export type BalanceNode = {
  id: string
  kind: NodeKind
  parentId: string | null
  name: string
  color: string
  /** Icon id, or `null` for the wallet/stack default of this kind. */
  icon: string | null
  note: string | null
  position: number
  collapsed: boolean
  /** When it was archived — kept with its history, hidden from the live tree. */
  archivedAt: string | null
  amount: number | null
  currency: CurrencyCode | null
  createdAt: string
  updatedAt: string
  version: string
}

/** The per-user planning settings that ride on the balance-settings row. */
export type PlanningSettings = {
  safeHorizon: SafeHorizon
  /** 7–90; set exactly when `safeHorizon` is 'days'. */
  safeHorizonDays: number | null
  paydayMode: PaydayMode
  /** The stream that sets the pay periods; null = the largest monthly stream. */
  mainIncomeStreamId: string | null
  incomeVaries: boolean
  /** Monthly floor in base-currency minor units; set only while `incomeVaries`. */
  incomeFloor: number | null
}

export const DEFAULT_PLANNING_SETTINGS: PlanningSettings = {
  safeHorizon: 'until_payday',
  safeHorizonDays: null,
  paydayMode: 'review',
  mainIncomeStreamId: null,
  incomeVaries: false,
  incomeFloor: null,
}

export type BalanceSettings = PlanningSettings & {
  baseCurrency: CurrencyCode
  createdAt: string
  updatedAt: string
  version: string
}

export type ExchangeRate = {
  currency: CurrencyCode
  rate: number
  version: string
  updatedAt: string
}

// --- Wire types (snake_case) ---------------------------------------------------------

export type BalanceNodeWire = {
  id: string
  kind: NodeKindWire
  parent_id: string | null
  name: string
  color: string
  icon: string | null
  note: string | null
  position: number
  collapsed: boolean
  archived_at: string | null
  amount: number | null
  currency: string | null
  created_at: string
  updated_at: string
  version: string
}

export type BalanceSettingsWire = {
  base_currency: string
  safe_horizon?: SafeHorizonWire
  safe_horizon_days?: number | null
  payday_mode?: PaydayModeWire
  main_income_stream_id?: string | null
  income_varies?: boolean
  income_floor?: number | null
  created_at: string
  updated_at: string
  version: string
}

export type ExchangeRateWire = {
  id: string
  currency: string
  rate: string
  created_at: string
  updated_at: string
  version: string
}

// Payloads sent to the backend (wire shape).

/** A full representation: anything omitted resets to its default on the server. */
export type UpdateSettingsWire = {
  version: string
  base_currency: string
  safe_horizon: SafeHorizonWire
  safe_horizon_days: number | null
  payday_mode: PaydayModeWire
  main_income_stream_id: string | null
  income_varies: boolean
  income_floor: number | null
}
export type CreateNodeWire = {
  id: string
  kind: NodeKindWire
  parent_id: string | null
  name: string
  color: string
  icon: string | null
  note: string | null
  position: number
  collapsed: boolean
  archived: boolean
  amount: number | null
  currency: string | null
}

export type UpdateNodeWire = {
  version: string
  name: string
  color: string
  icon: string | null
  note: string | null
  parent_id: string | null
  position: number
  collapsed: boolean
  archived: boolean
  amount: number | null
  currency: string | null
}

// --- Mappers -------------------------------------------------------------------------

export const toNode = (w: BalanceNodeWire): BalanceNode => ({
  id: w.id,
  kind: fromWireKind(w.kind),
  parentId: w.parent_id,
  name: w.name,
  color: w.color,
  icon: w.icon,
  note: w.note,
  position: w.position,
  collapsed: w.collapsed,
  archivedAt: w.archived_at ?? null,
  amount: w.amount,
  currency: fromWireCurrencyOrNull(w.currency),
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toSettings = (w: BalanceSettingsWire): BalanceSettings => ({
  baseCurrency: fromWireCurrency(w.base_currency),
  safeHorizon: w.safe_horizon
    ? fromWireHorizon(w.safe_horizon)
    : DEFAULT_PLANNING_SETTINGS.safeHorizon,
  safeHorizonDays: w.safe_horizon_days ?? null,
  paydayMode: w.payday_mode
    ? fromWirePaydayMode(w.payday_mode)
    : DEFAULT_PLANNING_SETTINGS.paydayMode,
  mainIncomeStreamId: w.main_income_stream_id ?? null,
  incomeVaries: w.income_varies ?? false,
  incomeFloor: w.income_floor ?? null,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toRate = (w: ExchangeRateWire): ExchangeRate => ({
  currency: fromWireCurrency(w.currency),
  rate: Number(w.rate),
  version: w.version,
  updatedAt: w.updated_at,
})
