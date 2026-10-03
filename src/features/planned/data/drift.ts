/**
 * Whether a recalc would change the set-asides a goal's or bill's stored plan has written, and
 * both sides in brief. The plan's headline can agree with today's while its rows do not (two
 * SR 1,750 set-asides where one of SR 3,500 is wanted), so the rows themselves are compared.
 *
 * Only rows a recalc may rewrite count, and only up to the plan's last set-aside: past it the
 * background fill writes the live plan's rows anyway. Pure.
 */
import type { LocalPlanned } from '#/db/types'
import { isRewritable } from './fit'
import type { DesiredPlanned } from './generate'
import { isPlanRowOf } from './owners'
import type { PlanOwner } from './owners'

/** A run of set-asides in brief: "SR 1,750 × 2 from Oct 25". */
export type PlanRun = {
  total: number
  count: number
  /** Every row's amount when they are all equal, else null. */
  each: number | null
  /** The first row's date, or null when there are none. */
  start: string | null
}

export type RowDrift = {
  /** The rows a recalc may rewrite, as they stand. */
  stored: PlanRun
  /** The same span as a recalc would write it. */
  live: PlanRun
  differ: boolean
}

type RunRow = Pick<LocalPlanned, 'amount' | 'occurrence'>

export function planRunOf(rows: ReadonlyArray<RunRow>): PlanRun {
  const sorted = [...rows].sort((a, b) =>
    a.occurrence.localeCompare(b.occurrence),
  )
  const first = sorted.at(0)
  return {
    total: sorted.reduce((a, r) => a + r.amount, 0),
    count: sorted.length,
    each:
      first && sorted.every((r) => r.amount === first.amount)
        ? first.amount
        : null,
    start: first?.occurrence ?? null,
  }
}

export function rowDrift(input: {
  owner: PlanOwner
  /** What a recalc writes (`fitPlan`'s `writable`). */
  writable: ReadonlyArray<DesiredPlanned>
  existing: ReadonlyArray<LocalPlanned>
  today: string
  isSettled: (row: LocalPlanned) => boolean
}): RowDrift {
  const mine = input.existing.filter(
    (p) => p.deleted === 0 && isPlanRowOf(p, input.owner),
  )
  const last = mine.reduce<string | null>(
    (a, p) => (a === null || p.occurrence > a ? p.occurrence : a),
    null,
  )
  const stored = mine.filter((p) =>
    isRewritable(p, input.today, input.isSettled),
  )
  const live =
    last === null ? [] : input.writable.filter((d) => d.occurrence <= last)
  const wanted = new Map(live.map((d) => [d.id, d.amount]))
  return {
    stored: planRunOf(stored),
    live: planRunOf(live),
    differ:
      stored.length !== live.length ||
      stored.some((p) => wanted.get(p.id) !== p.amount),
  }
}
