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
  amount: number | null
  currency: CurrencyCode | null
  createdAt: string
  updatedAt: string
  version: string
}

export type BalanceSettings = {
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
  amount: number | null
  currency: string | null
  created_at: string
  updated_at: string
  version: string
}

export type BalanceSettingsWire = {
  base_currency: string
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
  amount: w.amount,
  currency: fromWireCurrencyOrNull(w.currency),
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toSettings = (w: BalanceSettingsWire): BalanceSettings => ({
  baseCurrency: fromWireCurrency(w.base_currency),
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
