import type { PlanningSection } from '#/features/planning/sections'

export type SectionBadge = {
  count: number
  tone: 'warn' | 'danger'
  label: string
}

/** Upcoming counts what needs confirming; Overview counts what needs a decision. */
export function sectionBadges(
  dueCount: number,
  decisions: number,
): Partial<Record<PlanningSection, SectionBadge>> {
  return {
    ...(dueCount > 0
      ? {
          upcoming: {
            count: dueCount,
            tone: 'warn' as const,
            label: `${dueCount} need confirming`,
          },
        }
      : {}),
    ...(decisions > 0
      ? {
          overview: {
            count: decisions,
            tone: 'danger' as const,
            label: `${decisions} need a decision`,
          },
        }
      : {}),
  }
}
