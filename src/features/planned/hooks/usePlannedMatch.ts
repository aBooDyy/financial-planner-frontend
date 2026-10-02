import { useMemo } from 'react'
import type { LocalPlanned } from '#/db/types'
import type { PlannedRole } from '#/features/planned/api/types'
import { findMatch } from '#/features/planned/data/settle'
import type { MatchRef } from '#/features/planned/data/settle'
import { matchSummary, shortDate } from '#/features/planned/data/views'
import { formatMoney } from '#/lib/currency'
import { usePlannedData } from './usePlannedData'

export type PlannedMatch = {
  item: LocalPlanned
  /** What is still open on it, in its currency. */
  remainder: number
  /** "Matches the planned Sep 1 set-aside (SR 1,500). Saving will settle it instead of adding a second entry." */
  hint: string
}

const WHAT: Record<PlannedRole, string> = {
  set_aside: 'set-aside',
  payment: 'payment',
  income: 'payday',
}

/**
 * The planned item an entry being written would settle (1e's "Counts toward" hint): the
 * origin's oldest open item of a matching role near `date`. Null when nothing matches or no
 * origin is chosen. Save it by passing `match.item.id` as the entry's `plannedId`.
 */
export function usePlannedMatch(
  ref: MatchRef | null,
  roles: PlannedRole | ReadonlyArray<PlannedRole>,
  date: string,
): PlannedMatch | null {
  const data = usePlannedData()
  const refKey = ref ? JSON.stringify(ref) : ''
  const rolesKey = typeof roles === 'string' ? roles : roles.join(',')
  return useMemo(() => {
    if (!ref) return null
    const item = findMatch(ref, roles, date, data.inputs.planned)
    if (!item) return null
    const { remainder } = matchSummary(
      item,
      data.state.index,
      data.inputs.rates,
    )
    return {
      item,
      remainder,
      hint: `Matches the upcoming ${shortDate(item.date)} ${WHAT[item.role]} (${formatMoney(remainder, item.currency)}). Saving will settle it instead of adding a second entry.`,
    }
    // `ref` and `roles` are keyed by their content.
  }, [refKey, rolesKey, date, data.inputs, data.state])
}
