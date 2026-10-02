import { isUuid } from '#/lib/uuid'
import type { PlanningSection } from '#/features/planning/sections'
import { SECTION_FROM_GOALS, encodePlanningOpen } from './openParam'

/** Where an old `/goals[/<section>][?goal=<id>]` link lands: a Planning section, maybe opening the goal. */
export function goalsRedirect(
  section: string | undefined,
  goalId: string | undefined,
): { section: PlanningSection; open?: string } {
  if (isUuid(goalId))
    return {
      section: 'goals',
      open: encodePlanningOpen({ kind: 'goal', id: goalId }),
    }
  return {
    section:
      (section === undefined ? undefined : SECTION_FROM_GOALS[section]) ??
      'overview',
  }
}
