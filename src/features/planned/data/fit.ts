/**
 * What a recalculation of one goal's or bill's plan actually writes, and therefore what "From
 * today" shows.
 *
 * The engine plans an owner's remaining money over every set-aside date from today. Some of
 * those dates may already be taken by a row the planner must not rewrite — confirmed early,
 * skipped, moved, partly settled — and a deterministic id means no second row can be made for
 * the same date. What those dates were meant to carry is spread over the rows that *can* be
 * written, so the future plan still adds up to what is left:
 *
 *   to write = Σ planned from today − Σ still open on future rows nobody may rewrite
 *
 * split over the writable dates in proportion to the engine's own amounts (an even split for
 * a flat plan), the last one taking the rounding. With nothing in the way the split is the
 * engine's plan exactly. Pure; payments are never touched.
 */
import type { LocalPlanned } from '#/db/types'
import type { RatesMap } from '#/lib/config/rates'
import type { DesiredPlanned } from './generate'
import { isPlanRowOf, isSetAsideFor } from './owners'
import type { PlanOwner } from './owners'
import { hasSettlements, remainderOf } from './settle'
import type { SettlementIndex } from './settle'
import { planHeaderOf } from './snapshot'
import type { PlanHeader } from './snapshot'

export type FitInput = {
  owner: PlanOwner
  desired: ReadonlyArray<DesiredPlanned>
  existing: ReadonlyArray<LocalPlanned>
  /** ISO date. */
  today: string
  isSettled: (row: LocalPlanned) => boolean
  remainderOf: (row: LocalPlanned) => number
}

export type FittedPlan = {
  /** The owner's desired set-asides, fitted — what a recalc hands the reconciler. */
  rows: DesiredPlanned[]
  /** The set-asides a recalc writes (created or rewritten), with their fitted amounts. */
  writable: DesiredPlanned[]
  /** The headline of that plan: amount, count and the dates it spans. */
  header: PlanHeader
}

/** The only rows a recalc may rewrite: future, open, unpinned, unsettled. */
export const isRewritable = (
  row: LocalPlanned,
  today: string,
  isSettled: (row: LocalPlanned) => boolean,
): boolean =>
  row.status === 'open' &&
  row.occurrence > today &&
  !row.pinned &&
  !isSettled(row)

/** `total` over `weights`, each rounded to minor units, the last taking what is left. */
function split(total: number, weights: ReadonlyArray<number>): number[] {
  if (weights.length === 0) return []
  const sum = weights.reduce((a, w) => a + w, 0)
  const shares = weights.map((w) =>
    Math.round(sum > 0 ? (total * w) / sum : total / weights.length),
  )
  const others = shares.slice(0, -1).reduce((a, s) => a + s, 0)
  shares[shares.length - 1] = total - others
  return shares
}

export function fitPlan(input: FitInput): FittedPlan {
  const { owner, today } = input
  const rewritable = (row: LocalPlanned) =>
    isRewritable(row, today, input.isSettled)
  const held = new Map(
    input.existing.filter((p) => p.deleted === 0).map((p) => [p.id, p]),
  )
  const mine = input.desired.filter((d) => isPlanRowOf(d, owner))
  const planned = mine.filter((d) => d.occurrence >= today)
  const plannedIds = new Set(planned.map((d) => d.id))

  const slots: DesiredPlanned[] = []
  const blocked = new Set<string>()
  let committed = 0
  const commit = (row: LocalPlanned) => {
    if (row.status === 'open' && row.date > today)
      committed += input.remainderOf(row)
  }
  for (const d of planned) {
    const row = held.get(d.id)
    if (!row || rewritable(row)) {
      slots.push(d)
      continue
    }
    blocked.add(d.id)
    commit(row)
  }
  // Rows outside the new schedule that will still happen: hand-made ones, and generated ones
  // nobody may rewrite (a rewritable one outside the schedule is about to be removed).
  for (const row of held.values()) {
    if (!isSetAsideFor(row, owner) || plannedIds.has(row.id)) continue
    if (
      row.origin === 'manual' ||
      (isPlanRowOf(row, owner) && !rewritable(row))
    )
      commit(row)
  }

  const total = Math.max(
    0,
    planned.reduce((a, d) => a + d.amount, 0) - committed,
  )
  const amounts = split(
    total,
    slots.map((d) => d.amount),
  )
  const writable = slots
    .map((d, i) => ({ ...d, amount: amounts[i] }))
    .filter((d) => d.amount > 0)

  const rows = mine
    .filter((d) => !plannedIds.has(d.id) || blocked.has(d.id))
    .concat(writable)
  const header = planHeaderOf(owner, writable, today)
  return { rows, writable, header }
}

/** The same fit, from the planner's state. */
export const fitPlanFrom = (
  owner: PlanOwner,
  desired: ReadonlyArray<DesiredPlanned>,
  existing: ReadonlyArray<LocalPlanned>,
  index: SettlementIndex,
  rates: RatesMap,
  today: string,
): FittedPlan =>
  fitPlan({
    owner,
    desired,
    existing,
    today,
    isSettled: (row) => hasSettlements(row, index),
    remainderOf: (row) => remainderOf(row, index, rates),
  })
