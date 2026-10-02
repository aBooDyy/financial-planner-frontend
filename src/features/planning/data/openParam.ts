import { isUuid } from '#/lib/uuid'
import type { PlanningSection } from '#/features/planning/sections'

/** What `/planning?open=<kind>:<id>` asks the Planning page to open. */
export const PLANNING_OPEN_KINDS = [
  'bill',
  'goal',
  'income',
  'planned',
] as const

export type PlanningOpenKind = (typeof PLANNING_OPEN_KINDS)[number]

export type PlanningOpenIntent = { kind: PlanningOpenKind; id: string }

/** The section each kind opens on. */
export const PLANNING_OPEN_SECTION: Record<PlanningOpenKind, PlanningSection> =
  {
    bill: 'bills',
    goal: 'goals',
    income: 'income',
    planned: 'upcoming',
  }

const isOpenKind = (value: string): value is PlanningOpenKind =>
  (PLANNING_OPEN_KINDS as readonly string[]).includes(value)

export const encodePlanningOpen = ({ kind, id }: PlanningOpenIntent): string =>
  `${kind}:${id}`

/** The intent a `?open=` value names, or null for anything malformed. */
export function parsePlanningOpen(value: unknown): PlanningOpenIntent | null {
  if (typeof value !== 'string') return null
  const split = value.indexOf(':')
  if (split < 0) return null
  const kind = value.slice(0, split)
  const id = value.slice(split + 1)
  return isOpenKind(kind) && isUuid(id) ? { kind, id } : null
}

/** Where an old `/goals/<section>` link lands now. */
export const SECTION_FROM_GOALS: Partial<Record<string, PlanningSection>> = {
  summary: 'overview',
  goals: 'goals',
  obligations: 'bills',
  income: 'income',
  timeline: 'upcoming',
}
