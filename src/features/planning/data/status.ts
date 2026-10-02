/**
 * Where each bill and goal stands, in the docs' words (02 Status, D27): Covered · Saving up ·
 * Behind · Short · Due (bills), Reached · Paused (goals), plus Done / Paid once finished. Pure,
 * over the planner's inputs and state.
 */
import type { LocalBill, LocalGoal, LocalPlanned } from '#/db/types'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import { addDaysISO } from '#/features/planned/data/dates'
import { remainderOf } from '#/features/planned/data/settle'
import type { PlannerInputs, PlannerState } from '#/features/planned/data/state'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { convertMinor } from '#/lib/currency'
import { isGoalReached, roundedSchedule, tracksOf } from './funding'
import type { FundingPlan, OwnerKind, TrackPlan } from './funding'
import {
  isSettledOccurrence,
  occurrenceBefore,
  openOccurrences,
  paymentRowsOf,
} from './occurrences'
import { paydaysIn } from './payPeriods'

export type BillState =
  | 'covered'
  | 'saving_up'
  | 'behind'
  | 'short'
  | 'not_set_aside'
  | 'due'
  | 'paid'
  | 'done'

/** Money held for an occurrence or a goal, by wallet (or outside). */
export type HeldLine = {
  walletId: string | null
  externalLabel: string | null
  /** In the owner's currency. */
  amount: number
}

export type OccurrenceView = {
  occurrence: string
  amount: number
  setAside: number
}

export type BillStatus = {
  billId: string
  state: BillState
  /** The occurrence the state is about — the first open one; null once there is none. */
  occurrence: string | null
  /** Bill currency throughout. */
  amount: number
  setAside: number
  /** Behind: planned set-asides for this occurrence that came due and were not made. */
  behindBy: number
  /** Short: what the plan cannot cover by the due date. */
  shortBy: number
  /** The payday the plan finishes covering it on. */
  coveredOn: string | null
  /** Covered whole from one paycheck, or saved up over several. */
  cycle: 'each_paycheck' | 'save_up'
  /** At the next payday: what the plan sets aside for it, and what it would with pay unlimited. */
  perPaycheck: number
  requiredPerPaycheck: number
  heldIn: HeldLine[]
  /** The next open occurrences (up to three). */
  next: OccurrenceView[]
}

export type GoalState =
  | 'saving_up'
  | 'behind'
  | 'short'
  | 'reached'
  | 'paused'
  | 'done'

export type GoalStatus = {
  goalId: string
  state: GoalState
  /** No target: it never finishes ("Saving up · ongoing"). */
  ongoing: boolean
  /** Goal currency throughout: live set-asides + used. */
  progress: number
  setAside: number
  used: number
  /** 0 without a target. */
  target: number
  left: number
  behindBy: number
  shortBy: number
  perPaycheck: number
  requiredPerPaycheck: number
  /** When the plan reaches the target; null without one, or beyond the plan's reach. */
  finish: string | null
  /** A dated goal that won't make its date: roughly when it would. */
  slipsTo: string | null
  heldIn: HeldLine[]
}

/** The slot-0 figure of an owner's tracks: Σ funded and Σ required at the next payday. */
function atNextPayday(tracks: ReadonlyArray<TrackPlan>): {
  funded: number
  required: number
} {
  let funded = 0
  let required = 0
  for (const t of tracks) {
    if (t.funded.length === 0) continue
    funded += roundedSchedule(t.funded)[0]
    required += roundedSchedule(t.required)[0]
  }
  return { funded, required }
}

/** Σ still open on an owner's planned set-asides that came due — set-asides not made yet. */
function unmadeSetAsides(
  kind: OwnerKind,
  ownerId: string,
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
  from = '',
): number {
  return inputs.planned
    .filter(
      (p) =>
        p.deleted === 0 &&
        p.status === 'open' &&
        p.role === 'set_aside' &&
        (kind === 'goal' ? p.goalId : p.billId) === ownerId &&
        p.date <= today &&
        p.date > from,
    )
    .reduce((sum, p) => sum + remainderOf(p, state.index, inputs.rates), 0)
}

function heldLines(
  rows: ReadonlyArray<{
    source: 'wallet' | 'outside'
    walletId: string | null
    externalLabel: string | null
    amount: number
  }>,
): HeldLine[] {
  const byPlace = new Map<string, HeldLine>()
  for (const r of rows) {
    const key =
      r.source === 'wallet' ? `w:${r.walletId}` : `o:${r.externalLabel}`
    const line = byPlace.get(key)
    if (line) line.amount += r.amount
    else
      byPlace.set(key, {
        walletId: r.source === 'wallet' ? r.walletId : null,
        externalLabel: r.source === 'outside' ? r.externalLabel : null,
        amount: r.amount,
      })
  }
  return [...byPlace.values()].sort((a, b) => b.amount - a.amount)
}

const slotDate = (funding: FundingPlan, k: number | null): string | null =>
  k === null ? null : (funding.slots[k]?.date ?? null)

/** Whether one payday covers an occurrence, or it is saved up for over several. */
export function cycleOf(
  bill: LocalBill,
  track: TrackPlan | undefined,
  funding: FundingPlan,
): BillStatus['cycle'] {
  if (track && track.end >= 0)
    return track.end - track.start < 1 ? 'each_paycheck' : 'save_up'
  if (bill.frequency === null) return 'each_paycheck'
  return frequencyMetaOf(bill, 'monthly').perYear >=
    funding.calendar.perYear - 1e-9
    ? 'each_paycheck'
    : 'save_up'
}

/** What a payment row has had paid on it so far, in its own currency. */
const paidOnRow = (
  row: LocalPlanned,
  state: PlannerState,
  inputs: PlannerInputs,
): number => row.amount - remainderOf(row, state.index, inputs.rates)

export function billStatusOf(
  bill: LocalBill,
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
): BillStatus {
  const { rates } = inputs
  const payments = paymentRowsOf(bill.id, inputs.planned)
  const open = openOccurrences(bill, payments, state.funding.horizonEnd)
  const tracks = tracksOf(state.funding, 'bill', bill.id)
  const live = inputs.setAsides.filter(
    (a) => a.billId === bill.id && isLiveSetAside(a),
  )
  const heldFor = (occurrence: string) =>
    live
      .filter((a) => a.occurrence === occurrence)
      .map((a) => ({
        ...a,
        amount: convertMinor(a.amount, a.currency, bill.currency, rates),
      }))
  const paidOn = (occurrence: string) => {
    const row = payments.get(occurrence)
    return row ? paidOnRow(row, state, inputs) : 0
  }
  const occurrence =
    bill.closedAt === null
      ? (open[0] ??
        (isSettledOccurrence(payments, bill.nextDue) ? null : bill.nextDue))
      : null
  const track = tracks.find((t) => t.occurrence === occurrence)
  const held = occurrence ? heldFor(occurrence) : []
  const setAside = held.reduce((sum, a) => sum + a.amount, 0)
  const pace = atNextPayday(tracks)
  const previous =
    occurrence && bill.frequency !== null
      ? occurrenceBefore(bill, payments, occurrence)
      : ''
  const behindBy = occurrence
    ? unmadeSetAsides('bill', bill.id, inputs, state, today, previous)
    : 0
  const shortBy = track && track.end >= track.start ? track.shortfall : 0

  const billState: BillState =
    bill.closedAt !== null
      ? 'done'
      : occurrence === null
        ? 'paid'
        : occurrence <= today
          ? 'due'
          : setAside + paidOn(occurrence) >= bill.amount
            ? 'covered'
            : track && track.end < track.start
              ? 'not_set_aside'
              : shortBy > 0.5
                ? 'short'
                : behindBy > 0
                  ? 'behind'
                  : 'saving_up'

  return {
    billId: bill.id,
    state: billState,
    occurrence,
    amount: bill.amount,
    setAside,
    behindBy,
    shortBy: Math.round(shortBy),
    coveredOn: slotDate(state.funding, track?.completesAt ?? null),
    cycle: cycleOf(bill, track, state.funding),
    perPaycheck: pace.funded,
    requiredPerPaycheck: pace.required,
    heldIn: heldLines(held),
    next: open.slice(0, 3).map((o) => ({
      occurrence: o,
      amount: bill.amount,
      setAside: heldFor(o).reduce((sum, a) => sum + a.amount, 0),
    })),
  }
}

/** Roughly when a dated goal short of its date would get there at the pace it was getting. */
function slipDate(track: TrackPlan, funding: FundingPlan): string | null {
  if (track.shortfall <= 0.5 || track.end < track.start) return null
  const slots = track.end - track.start + 1
  const pace = track.funded.reduce((a, b) => a + b, 0) / slots
  if (pace <= 0) return null
  const extra = Math.ceil(track.shortfall / pace)
  const from = addDaysISO(funding.slots[track.end].date, 1)
  const later = paydaysIn(funding.calendar, from, addDaysISO(from, 3660))
  return later[extra - 1] ?? null
}

export function goalStatusOf(
  goal: LocalGoal,
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
): GoalStatus {
  const progress = state.progress[goal.id]
  const saved = progress?.progress ?? 0
  const target = goal.target ?? 0
  const track = tracksOf(state.funding, 'goal', goal.id).at(0)
  const pace = atNextPayday(track ? [track] : [])
  const behindBy = unmadeSetAsides('goal', goal.id, inputs, state, today)
  const shortBy = track && track.perSlot === null ? track.shortfall : 0
  const reached = isGoalReached(goal, saved)
  const goalState: GoalState =
    goal.closedAt !== null
      ? 'done'
      : goal.pausedAt !== null
        ? 'paused'
        : reached
          ? 'reached'
          : shortBy > 0.5
            ? 'short'
            : behindBy > 0
              ? 'behind'
              : 'saving_up'
  const outside = progress?.outside ?? 0
  return {
    goalId: goal.id,
    state: goalState,
    ongoing: target <= 0,
    progress: saved,
    setAside: progress?.setAside ?? 0,
    used: progress?.used ?? 0,
    target,
    left: Math.max(0, target - saved),
    behindBy,
    shortBy: Math.round(shortBy),
    perPaycheck: pace.funded,
    requiredPerPaycheck: pace.required,
    finish: track ? slotDate(state.funding, track.completesAt) : null,
    slipsTo: track ? slipDate(track, state.funding) : null,
    heldIn: [
      ...Object.entries(progress?.byWallet ?? {}).map(([walletId, amount]) => ({
        walletId,
        externalLabel: null,
        amount: amount ?? 0,
      })),
      ...(outside > 0
        ? [{ walletId: null, externalLabel: null, amount: outside }]
        : []),
    ].sort((a, b) => b.amount - a.amount),
  }
}

/** Every live bill's status, by id. */
export const billStatuses = (
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
): Record<string, BillStatus> =>
  Object.fromEntries(
    inputs.bills.map((b) => [b.id, billStatusOf(b, inputs, state, today)]),
  )

/** Every live goal's status, by id. */
export const goalStatuses = (
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
): Record<string, GoalStatus> =>
  Object.fromEntries(
    inputs.goals.map((g) => [g.id, goalStatusOf(g, inputs, state, today)]),
  )
