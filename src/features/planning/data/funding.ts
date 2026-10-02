/**
 * The funding engine: what to set aside on each payday so every bill is covered by its due
 * date and every goal moves toward its target — and what fits when pay can't cover it all.
 *
 * - **Slots** are the main paydays from today (calendar 1sts without a main paycheck). A
 *   slot's capacity is the income landing in its pay period, base minor units; the income-
 *   varies floor replaces it when set; with no income at all it is unlimited.
 * - **Tracks**: one per open bill occurrence, one per active goal.
 *   - A bill occurrence is funded over its *window*: the slots after the previous
 *     occurrence's last slot, through the last slot on or before its due date. A bill due
 *     within one pay period is covered whole on that payday; a longer cycle (or a far one-off)
 *     saves up in equal installments. When income varies, bills are covered a month ahead:
 *     the window ends on the slot before the due month. A window may be empty — a bill due
 *     before the next payday is "not set aside yet".
 *   - A goal with a target and a date spreads what is left over the slots through its date;
 *     one with a monthly amount draws that amount per paycheck (until its target, or its date).
 *   - What is already set aside (and, for a bill, already paid) is subtracted first, so being
 *     ahead lowers what is still needed.
 * - **Priority** (D10): must-pay bills, then must-have goals, then nice-to-have bills and
 *   goals; earliest deadline first within a tier (ongoing goals last), position breaks ties.
 *   Each slot pays tracks in that order at the pace that finishes them in their window; a
 *   track that ran out of income catches up later, at a higher pace. A must-pay bill or a
 *   must-have goal with a deadline takes at least what later slots could no longer cover
 *   (`laterRoom`), so pay that is about to stop goes to it before a nice-to-have.
 *
 * The plan runs twice: once against income (`funded`) and once unlimited (`required` — what
 * the plan needs, which the "Each paycheck" picture and the verdict compare to income).
 */
import type {
  LocalBill,
  LocalGoal,
  LocalIncomeStream,
  LocalPlanned,
  LocalSetAside,
} from '#/db/types'
import { settledOf } from '#/features/planned/data/settle'
import type { SettlementIndex } from '#/features/planned/data/settle'
import { addDaysISO, addMonthsISO } from '#/features/planned/data/dates'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import type { PlanningSettings } from '#/features/wallets/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import {
  billOccurrences,
  isSettledOccurrence,
  paymentRowsOf,
} from './occurrences'
import {
  incomeBetween,
  payCalendarOf,
  paydayAfter,
  paydaysIn,
  perPaycheck,
} from './payPeriods'
import type { PayCalendar } from './payPeriods'

export type OwnerKind = 'bill' | 'goal'
/** 1 must-pay bills · 2 must-have goals · 3 nice to have. */
export type Tier = 1 | 2 | 3

export type FundingTrack = {
  /** `bill:<id>:<occurrence>` or `goal:<id>`. */
  key: string
  kind: OwnerKind
  ownerId: string
  /** A bill's due date this track covers; null for a goal. */
  occurrence: string | null
  tier: Tier
  /** Covered by: a bill's due date, a goal's date; null = ongoing. */
  deadline: string | null
  position: number
  currency: CurrencyCode
  /** Still needed when the plan starts, owner currency; Infinity for an open-ended draw. */
  need: number
  /** An ongoing goal's draw per paycheck (owner currency); null for a finite track. */
  perSlot: number | null
  /** First and last slot it may be funded in (inclusive); `end < start` = none. */
  start: number
  end: number
}

export type TrackPlan = FundingTrack & {
  /** Set aside per slot against income, owner currency (unrounded). */
  funded: number[]
  /** Per slot with income unlimited. */
  required: number[]
  /** Finite tracks: what the funded plan leaves uncovered by the deadline. */
  shortfall: number
  /** The slot the funded plan covers it in (finite, or ongoing with a target); else null. */
  completesAt: number | null
}

export type FundingSlot = {
  date: string
  /** Income in its pay period, base minor units; Infinity when unknown (no income). */
  capacity: number
}

export type FundingPlan = {
  calendar: PayCalendar
  slots: FundingSlot[]
  tracks: TrackPlan[]
  /** No income to plan against: every track is funded as required. */
  unlimited: boolean
  /** The last day the plan looks at. */
  horizonEnd: string
}

export type FundingInput = {
  bills: ReadonlyArray<LocalBill>
  goals: ReadonlyArray<LocalGoal>
  income: ReadonlyArray<LocalIncomeStream>
  planned: ReadonlyArray<LocalPlanned>
  setAsides: ReadonlyArray<LocalSetAside>
  /** Each goal's progress so far (live set-asides + used), goal currency. */
  progress: Readonly<Record<string, number>>
  index: SettlementIndex
  settings: PlanningSettings
  base: CurrencyCode
  rates: RatesMap
  today: string
}

const EPS = 0.5
const MIN_MONTHS = 13
const MAX_MONTHS = 120

/** Unrounded conversion factor — the engine works in fractions and rounds at the end. */
export const rateOf = (
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RatesMap,
): number =>
  from === to ? 1 : convertMinor(1_000_000_000, from, to, rates) / 1_000_000_000

/** Closed and paused goals plan nothing. */
export const isPlannableGoal = (
  g: Pick<LocalGoal, 'closedAt' | 'pausedAt' | 'deleted'>,
): boolean => g.deleted === 0 && g.closedAt === null && g.pausedAt === null

/**
 * Whether a planned row's bill or goal takes no money now: a closed bill, a closed or paused
 * goal. Its rows are not set aside, reviewed or counted ahead.
 */
export const isStoppedOwner = (
  row: Pick<LocalPlanned, 'billId' | 'goalId'>,
  bills: ReadonlyMap<string, Pick<LocalBill, 'closedAt'>>,
  goals: ReadonlyMap<string, Pick<LocalGoal, 'closedAt' | 'pausedAt'>>,
): boolean => {
  if (row.billId) return (bills.get(row.billId)?.closedAt ?? null) !== null
  const goal = row.goalId ? goals.get(row.goalId) : undefined
  return !!goal && (goal.closedAt !== null || goal.pausedAt !== null)
}

/** A goal with a target and a date: a finite plan, computed from what is left. */
export const isDatedTargetGoal = (
  g: Pick<LocalGoal, 'dueDate' | 'target'>,
): boolean => g.dueDate !== null && (g.target ?? 0) > 0

export const isGoalReached = (
  g: Pick<LocalGoal, 'target'>,
  progress: number,
): boolean => (g.target ?? 0) > 0 && progress >= (g.target ?? 0)

const lastDayBeforeMonth = (iso: string): string =>
  addDaysISO(`${iso.slice(0, 7)}-01`, -1)

/** Index of the last slot on or before `date`; -1 when none. */
function lastSlotOnOrBefore(
  slots: ReadonlyArray<string>,
  date: string,
): number {
  let lo = 0
  let hi = slots.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (slots[mid] <= date) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

function horizonEndOf(input: FundingInput): string {
  const { today } = input
  let end = addMonthsISO(today, MIN_MONTHS)
  for (const g of input.goals) {
    if (!isPlannableGoal(g)) continue
    if (g.dueDate) {
      const after = addMonthsISO(g.dueDate, 1)
      if (after > end) end = after
    } else if ((g.target ?? 0) > 0 && (g.amount ?? 0) > 0) {
      const left = (g.target ?? 0) - (input.progress[g.id] ?? 0)
      const months = Math.ceil(left / (g.amount ?? 1)) + 1
      const after = addMonthsISO(today, months)
      if (after > end) end = after
    }
  }
  const cap = addMonthsISO(today, MAX_MONTHS)
  return end > cap ? cap : end
}

function capacitiesOf(
  cal: PayCalendar,
  slots: ReadonlyArray<string>,
  input: FundingInput,
): { capacities: number[]; unlimited: boolean } {
  const { settings, base, rates } = input
  if (settings.incomeVaries && settings.incomeFloor !== null)
    return {
      capacities: slots.map(() => settings.incomeFloor ?? 0),
      unlimited: false,
    }
  const streams = input.income.filter((s) => s.deleted === 0)
  if (streams.length === 0 || (cal.kind === 'month' && !settings.incomeVaries))
    return { capacities: slots.map(() => Infinity), unlimited: true }
  return {
    capacities: slots.map((date, k) => {
      const next =
        k + 1 < slots.length
          ? slots[k + 1]
          : (paydayAfter(cal, date) ?? addDaysISO(date, 31))
      return incomeBetween(streams, date, addDaysISO(next, -1), base, rates)
    }),
    unlimited: false,
  }
}

function billTracks(
  bill: LocalBill,
  slots: ReadonlyArray<string>,
  input: FundingInput,
  horizonEnd: string,
): FundingTrack[] {
  if (bill.deleted !== 0 || bill.closedAt !== null || bill.amount <= 0)
    return []
  const rows = paymentRowsOf(bill.id, input.planned)
  const held = new Map<string, number>()
  for (const a of input.setAsides) {
    if (a.billId !== bill.id || !a.occurrence || !isLiveSetAside(a)) continue
    held.set(
      a.occurrence,
      (held.get(a.occurrence) ?? 0) +
        a.amount * rateOf(a.currency, bill.currency, input.rates),
    )
  }
  const deadlineOf = (due: string) =>
    input.settings.incomeVaries ? lastDayBeforeMonth(due) : due

  const out: FundingTrack[] = []
  let prevEnd = -1
  for (const due of billOccurrences(bill, rows, horizonEnd)) {
    const end = lastSlotOnOrBefore(slots, deadlineOf(due))
    let start = prevEnd + 1
    if (start > end && end >= 0) start = end
    prevEnd = Math.max(prevEnd, end)
    if (isSettledOccurrence(rows, due)) continue
    const row = rows.get(due)
    const paid = row ? settledOf(row, input.index, input.rates) : 0
    const need = Math.max(0, bill.amount - paid - (held.get(due) ?? 0))
    out.push({
      key: `bill:${bill.id}:${due}`,
      kind: 'bill',
      ownerId: bill.id,
      occurrence: due,
      tier: bill.mustPay ? 1 : 3,
      deadline: due,
      position: bill.position,
      currency: bill.currency,
      need,
      perSlot: null,
      start,
      end,
    })
  }
  return out
}

function goalTrack(
  goal: LocalGoal,
  slots: ReadonlyArray<string>,
  cal: PayCalendar,
  input: FundingInput,
): FundingTrack | null {
  if (!isPlannableGoal(goal)) return null
  const progress = input.progress[goal.id] ?? 0
  if (isGoalReached(goal, progress)) return null
  const common = {
    key: `goal:${goal.id}`,
    kind: 'goal' as const,
    ownerId: goal.id,
    occurrence: null,
    tier: (goal.mustHave ? 2 : 3) as Tier,
    deadline: goal.dueDate,
    position: goal.position,
    currency: goal.currency,
    start: 0,
    end: goal.dueDate
      ? lastSlotOnOrBefore(slots, goal.dueDate)
      : slots.length - 1,
  }
  if (isDatedTargetGoal(goal))
    return {
      ...common,
      need: (goal.target ?? 0) - progress,
      perSlot: null,
    }
  if ((goal.amount ?? 0) <= 0) return null
  return {
    ...common,
    need: (goal.target ?? 0) > 0 ? (goal.target ?? 0) - progress : Infinity,
    perSlot: perPaycheck(goal.amount ?? 0, cal),
  }
}

const byPriority = (a: FundingTrack, b: FundingTrack): number =>
  a.tier - b.tier ||
  (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31') ||
  a.position - b.position ||
  a.key.localeCompare(b.key)

type Run = {
  schedule: number[][]
  left: number[]
  completesAt: Array<number | null>
}

/**
 * For each must-pay bill and must-have dated goal, how much the slots after `k` could still
 * give it (owner currency): its need placed as late as its window allows, the higher priority
 * first, each taking what the ones before it left of a slot. Null for any other track.
 */
function laterRoom(
  tracks: ReadonlyArray<FundingTrack>,
  capacities: ReadonlyArray<number>,
  toBase: ReadonlyArray<number>,
): Array<number[] | null> {
  const n = capacities.length
  const room = [...capacities]
  return tracks.map((t, i) => {
    if (
      t.tier === 3 ||
      t.perSlot !== null ||
      !Number.isFinite(t.need) ||
      t.end < t.start ||
      toBase[i] <= 0
    )
      return null
    const placed = new Array<number>(n).fill(0)
    let left = t.need * toBase[i]
    for (let k = t.end; k >= t.start && left > EPS; k--) {
      const give = Math.min(left, room[k])
      placed[k] = give
      room[k] -= give
      left -= give
    }
    const after = new Array<number>(n).fill(0)
    let sum = 0
    for (let k = n - 1; k >= 0; k--) {
      after[k] = sum / toBase[i]
      sum += placed[k]
    }
    return after
  })
}

/** Walk the slots, paying tracks in priority order from each slot's capacity. */
function simulate(
  tracks: ReadonlyArray<FundingTrack>,
  capacities: ReadonlyArray<number>,
  toBase: ReadonlyArray<number>,
): Run {
  const n = capacities.length
  const schedule = tracks.map(() => new Array<number>(n).fill(0))
  const left = tracks.map((t) => t.need)
  const completesAt: Array<number | null> = tracks.map(() => null)
  const later = laterRoom(tracks, capacities, toBase)
  for (let k = 0; k < n; k++) {
    let cap = capacities[k]
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]
      if (k < t.start || k > t.end || left[i] <= EPS) continue
      if (cap <= EPS) break
      const even =
        t.perSlot === null
          ? left[i] / (t.end - k + 1)
          : Math.min(t.perSlot, left[i])
      const room = later[i]
      const floor = room ? left[i] - room[k] : 0
      const pace = Math.max(even, floor)
      const give = Math.min(pace, cap / toBase[i])
      if (give <= 0) continue
      schedule[i][k] = give
      left[i] -= give
      cap -= give * toBase[i]
      if (left[i] <= EPS && completesAt[i] === null) completesAt[i] = k
    }
  }
  return { schedule, left, completesAt }
}

export function planFunding(input: FundingInput): FundingPlan {
  const { today, base, rates } = input
  const calendar = payCalendarOf(
    input.income,
    input.settings,
    base,
    rates,
    today,
  )
  const horizonEnd = horizonEndOf(input)
  const dates = paydaysIn(calendar, today, horizonEnd)
  const { capacities, unlimited } = capacitiesOf(calendar, dates, input)

  const tracks: FundingTrack[] = []
  for (const bill of input.bills)
    tracks.push(...billTracks(bill, dates, input, horizonEnd))
  for (const goal of input.goals) {
    const track = goalTrack(goal, dates, calendar, input)
    if (track) tracks.push(track)
  }
  tracks.sort(byPriority)

  const toBase = tracks.map((t) => rateOf(t.currency, base, rates))
  const funded = simulate(tracks, capacities, toBase)
  const required = unlimited
    ? funded
    : simulate(
        tracks,
        capacities.map(() => Infinity),
        toBase,
      )

  return {
    calendar,
    slots: dates.map((date, k) => ({ date, capacity: capacities[k] })),
    tracks: tracks.map((t, i) => ({
      ...t,
      funded: funded.schedule[i],
      required: required.schedule[i],
      shortfall:
        t.perSlot === null && Number.isFinite(funded.left[i])
          ? Math.max(0, funded.left[i])
          : 0,
      completesAt: funded.completesAt[i],
    })),
    unlimited,
    horizonEnd,
  }
}

/**
 * A track's funded schedule in whole minor units, rounded on the running total so the slots
 * add up to exactly the rounded whole.
 */
export function roundedSchedule(values: ReadonlyArray<number>): number[] {
  let running = 0
  let written = 0
  return values.map((v) => {
    running += v
    const upTo = Math.round(running)
    const amount = upTo - written
    written = upTo
    return amount
  })
}

/** The tracks of one bill or goal, in date order. */
export const tracksOf = (
  plan: FundingPlan,
  kind: OwnerKind,
  ownerId: string,
): TrackPlan[] =>
  plan.tracks
    .filter((t) => t.kind === kind && t.ownerId === ownerId)
    .sort((a, b) => (a.occurrence ?? '').localeCompare(b.occurrence ?? ''))
