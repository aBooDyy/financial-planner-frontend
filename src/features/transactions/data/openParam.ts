import { isUuid } from '#/lib/uuid'
import type { SpendingView } from '#/features/transactions/constants'

/**
 * What `?open=<kind>:<id>` asks the Spending page to open. A transfer's id is its `transferId`.
 * Planned items open on Planning (`features/planning/data/openParam.ts`).
 */
export const OPEN_KINDS = ['tx', 'adjustment', 'transfer', 'budget'] as const

export type OpenKind = (typeof OPEN_KINDS)[number]

export type OpenIntent = { kind: OpenKind; id: string }

/** The tab each kind opens on. */
export const OPEN_VIEW: Record<OpenKind, SpendingView> = {
  tx: 'activity',
  adjustment: 'activity',
  transfer: 'activity',
  budget: 'budgets',
}

const isOpenKind = (value: string): value is OpenKind =>
  (OPEN_KINDS as readonly string[]).includes(value)

export const encodeOpenParam = ({ kind, id }: OpenIntent): string =>
  `${kind}:${id}`

/** The intent a `?open=` value names, or null for anything malformed. */
export function parseOpenParam(value: unknown): OpenIntent | null {
  if (typeof value !== 'string') return null
  const split = value.indexOf(':')
  if (split < 0) return null
  const kind = value.slice(0, split)
  const id = value.slice(split + 1)
  return isOpenKind(kind) && isUuid(id) ? { kind, id } : null
}
