/**
 * Overview's picture of the plan against pay (04 §5): what each paycheck has to carry — monthly
 * bills, saving up for bills due later, goals — and what is left for spending (negative when
 * the plan asks for more than comes in), the verdict over it, and the items that need a
 * decision. Base currency, read at the next payday with income unlimited (`required`), so a
 * shortfall shows instead of being clamped away. Pure.
 */
import type { LocalBill } from '#/db/types'
import { addMonthsISO } from '#/features/planned/data/dates'
import type { PlannerInputs, PlannerState } from '#/features/planned/data/state'
import { convertMinor } from '#/lib/currency'
import { isPlannableGoal, roundedSchedule } from './funding'
import type { FundingPlan, OwnerKind, TrackPlan } from './funding'

export type PaycheckItem = {
  kind: OwnerKind
  ownerId: string
  /** Base currency. */
  amount: number
}

export type PaycheckPart = {
  total: number
  /** How many bills or goals. */
  count: number
  items: PaycheckItem[]
}

export type EachPaycheck = {
  /** The payday it describes — the next one; null with no payday in reach. */
  payday: string | null
  /** What lands in that pay period; null when there is no income to plan against. */
  income: number | null
  /** Bills covered whole from the paycheck. */
  bills: PaycheckPart
  /** Bills due later, saved up for in installments. */
  savingUp: PaycheckPart
  goals: PaycheckPart
  /** `bills + savingUp + goals`. */
  planned: number
  /** `income − planned`; may be negative. Null without income. */
  left: number | null
}

export type Verdict =
  | { kind: 'start'; reason: 'empty' | 'no_income' }
  | {
      kind: 'short'
      /** Per paycheck when the plan outruns pay; in total when only some dates can't be met. */
      per: 'paycheck' | 'total'
      shortBy: number
      left: number
    }
  | { kind: 'tight'; left: number }
  | { kind: 'covered'; left: number }

export type Decision = {
  kind: OwnerKind
  ownerId: string
  /** A bill's occurrence that won't be covered; null for a goal. */
  occurrence: string | null
  /** Owner currency: what the plan cannot cover by the deadline. */
  shortBy: number
  /** Owner currency: what it would take at the next payday. */
  requiredPerPaycheck: number
  deadline: string | null
  /** A goal's suggested later date (six months on); null for a bill. */
  pushOutTo: string | null
}

/** Left below this share of pay reads as tight. */
export const TIGHT_SHARE = 0.1

const EPS = 0.5

const toBase = (t: TrackPlan, amount: number, inputs: PlannerInputs) =>
  convertMinor(amount, t.currency, inputs.base, inputs.rates)

/** A track funded whole from one paycheck, against one saved up over several. */
const isSavingUp = (t: TrackPlan) => t.end > t.start

function part(items: PaycheckItem[]): PaycheckPart {
  const merged = new Map<string, PaycheckItem>()
  for (const item of items) {
    const key = `${item.kind}:${item.ownerId}`
    const held = merged.get(key)
    if (held) held.amount += item.amount
    else merged.set(key, { ...item })
  }
  const list = [...merged.values()]
    .filter((i) => i.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  return {
    total: list.reduce((sum, i) => sum + i.amount, 0),
    count: list.length,
    items: list,
  }
}

export function eachPaycheck(
  inputs: PlannerInputs,
  state: PlannerState,
): EachPaycheck {
  const { funding } = state
  const first = funding.slots.at(0)
  const bills: PaycheckItem[] = []
  const savingUp: PaycheckItem[] = []
  const goals: PaycheckItem[] = []
  for (const t of funding.tracks) {
    if (!first || t.start > 0 || t.end < 0) continue
    const amount = toBase(t, roundedSchedule(t.required)[0], inputs)
    const item = { kind: t.kind, ownerId: t.ownerId, amount }
    if (t.kind === 'goal') goals.push(item)
    else (isSavingUp(t) ? savingUp : bills).push(item)
  }
  const billsPart = part(bills)
  const savingPart = part(savingUp)
  const goalsPart = part(goals)
  const planned = billsPart.total + savingPart.total + goalsPart.total
  const income =
    first && !funding.unlimited && Number.isFinite(first.capacity)
      ? first.capacity
      : null
  return {
    payday: first?.date ?? null,
    income,
    bills: billsPart,
    savingUp: savingPart,
    goals: goalsPart,
    planned,
    left: income === null ? null : income - planned,
  }
}

/** Tracks the funded plan leaves short by their deadline — ones that had a payday to try. */
const shortTracks = (funding: FundingPlan) =>
  funding.tracks.filter(
    (t) => t.perSlot === null && t.end >= t.start && t.shortfall > EPS,
  )

export function needsDecision(state: PlannerState): Decision[] {
  const seen = new Set<string>()
  const out: Decision[] = []
  for (const t of shortTracks(state.funding)) {
    const key = `${t.kind}:${t.ownerId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      kind: t.kind,
      ownerId: t.ownerId,
      occurrence: t.occurrence,
      shortBy: Math.round(t.shortfall),
      requiredPerPaycheck:
        t.required.length > 0 ? roundedSchedule(t.required)[0] : 0,
      deadline: t.deadline,
      pushOutTo:
        t.kind === 'goal' && t.deadline ? addMonthsISO(t.deadline, 6) : null,
    })
  }
  return out
}

const isPlannedBill = (b: LocalBill) => b.closedAt === null && b.amount > 0

export function verdictOf(
  inputs: PlannerInputs,
  state: PlannerState,
  paycheck: EachPaycheck = eachPaycheck(inputs, state),
): Verdict {
  if (!inputs.bills.some(isPlannedBill) && !inputs.goals.some(isPlannableGoal))
    return { kind: 'start', reason: 'empty' }
  if (paycheck.left === null || paycheck.income === null)
    return { kind: 'start', reason: 'no_income' }
  const left = paycheck.left
  if (left < 0) return { kind: 'short', per: 'paycheck', shortBy: -left, left }
  const short = shortTracks(state.funding).reduce(
    (sum, t) => sum + toBase(t, t.shortfall, inputs),
    0,
  )
  if (short > EPS)
    return { kind: 'short', per: 'total', shortBy: Math.round(short), left }
  if (left < paycheck.income * TIGHT_SHARE) return { kind: 'tight', left }
  return { kind: 'covered', left }
}
