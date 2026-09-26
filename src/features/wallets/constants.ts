import type { CurrencyCode } from '#/lib/currency'

// Color tags a wallet/group can wear (mirrors the Means design palette).
export const NODE_COLORS = [
  '#1F9D6B',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#EF4444',
  '#14B8A6',
  '#64748B',
] as const

export const DEFAULT_BASE_CURRENCY: CurrencyCode = 'SAR'

// Sentinel used by the "Place inside" select to mean top level (null parent on the wire).
export const ROOT_PARENT = 'root'
