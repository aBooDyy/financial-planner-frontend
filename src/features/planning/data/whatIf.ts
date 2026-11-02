/**
 * What if: the plan re-derived with things the user hasn't committed to, compared with the plan
 * as it stands. It runs the same engine over the same inputs, so an answer here is what the plan
 * would really say. Nothing is written. Pure.
 */
import type { LocalBudget } from '#/db/types'
import { billRowOf } from '#/features/bills/data/billRow'
import type { BillDraft } from '#/features/bills/data/mutations'
import { goalRowOf } from '#/features/goals/data/goalRow'
import type { GoalDraft } from '#/features/goals/data/mutations'
import { isoOf } from '#/features/planned/data/dates'
import { derivePlannerState } from '#/features/planned/data/state'
import type { PlannerInputs, PlannerState } from '#/features/planned/data/state'
import { budgetRowOf } from '#/features/transactions/data/budgetRow'
import type { BudgetDraft } from '#/features/transactions/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import { eachPaycheck, verdictOf } from './paycheck'
import type { EachPaycheck, Verdict } from './paycheck'
import { perSlotOf } from './everyday'
import { rateOf } from './funding'
import {
  billStatusOf,
  billStatuses,
  goalStatusOf,
  goalStatuses,
} from './status'

export type Tryout =
  | { kind: 'bill'; draft: BillDraft }
  | { kind: 'goal'; draft: GoalDraft }
  | { kind: 'everyday'; draft: BudgetDraft }

export type WhatIfItem = Tryout & {
  id: string
  /** Off keeps the item but leaves it out of the comparison. */
  on: boolean
}

/** How one tried item would do. Amounts are in `currency`. */
export type ItemOutcome = {
  id: string
  currency: CurrencyCode
  /** What it asks of each paycheck; 0 when none falls before it is due. */
  perPaycheck: number
  /** What the plan couldn't cover by its date. */
  shortBy: number
  /** A goal with a target: the payday it gets there, when it does. */
  finish: string | null
  /** A goal that misses its date: about when it would get there. */
  slipsTo: string | null
}

/** Something already in the plan that the tried items would change. */
export type KnockOn = {
  kind: 'bill' | 'goal'
  id: string
  name: string
  currency: CurrencyCode
} & (
  | { change: 'short'; shortBy: number; deadline: string | null }
  | { change: 'later'; from: string; to: string }
  | { change: 'slower'; from: number; to: number }
)

export type PlanPicture = { paycheck: EachPaycheck; verdict: Verdict }

export type WhatIfResult = {
  before: PlanPicture
  after: PlanPicture
  items: ItemOutcome[]
  knockOns: KnockOn[]
}

const EPS = 0.5
const TRIAL_TS = ''

const billOf = (id: string, draft: BillDraft, position: number) =>
  billRowOf(draft, { id, position, ts: TRIAL_TS })

const goalOf = (id: string, draft: GoalDraft, position: number) =>
  goalRowOf(draft, { id, position, ts: TRIAL_TS })

const nextPosition = (rows: ReadonlyArray<{ position: number }>) =>
  rows.reduce((max, r) => Math.max(max, r.position), -1) + 1

/** The plan's inputs with every switched-on item in it, as if it had been added last. */
export function inputsWith(
  inputs: PlannerInputs,
  items: ReadonlyArray<WhatIfItem>,
): PlannerInputs {
  const bills = [...inputs.bills]
  const goals = [...inputs.goals]
  const tried: LocalBudget[] = []
  for (const item of items) {
    if (!item.on) continue
    if (item.kind === 'bill')
      bills.push(billOf(item.id, item.draft, nextPosition(bills)))
    else if (item.kind === 'goal')
      goals.push(goalOf(item.id, item.draft, nextPosition(goals)))
    else tried.push(budgetRowOf(item.id, item.draft, TRIAL_TS))
  }
  // Adding a category that already has a budget changes that budget, so it doesn't count twice.
  const categories = new Set(tried.map((b) => b.categoryId))
  return {
    ...inputs,
    bills,
    goals,
    budgets: [
      ...inputs.budgets.filter(
        (b) => b.scopeType !== 'category' || !categories.has(b.categoryId),
      ),
      ...tried,
    ],
  }
}

function outcomeOf(
  item: WhatIfItem,
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
): ItemOutcome {
  const none = { shortBy: 0, finish: null, slipsTo: null }
  if (item.kind === 'bill') {
    const bill = inputs.bills.find((b) => b.id === item.id)
    if (!bill)
      return {
        id: item.id,
        currency: item.draft.currency,
        perPaycheck: 0,
        ...none,
      }
    const s = billStatusOf(bill, inputs, state, today)
    return {
      ...none,
      id: item.id,
      currency: bill.currency,
      perPaycheck: s.requiredPerPaycheck,
      shortBy: s.shortBy,
    }
  }
  if (item.kind === 'goal') {
    const goal = inputs.goals.find((g) => g.id === item.id)
    if (!goal)
      return {
        id: item.id,
        currency: item.draft.currency,
        perPaycheck: 0,
        ...none,
      }
    const s = goalStatusOf(goal, inputs, state, today)
    return {
      id: item.id,
      currency: goal.currency,
      perPaycheck: s.requiredPerPaycheck,
      shortBy: s.shortBy,
      finish: s.finish,
      slipsTo: s.slipsTo,
    }
  }
  return {
    ...none,
    id: item.id,
    currency: inputs.base,
    perPaycheck: Math.round(
      perSlotOf(
        item.draft.limit *
          rateOf(item.draft.currency, inputs.base, inputs.rates),
        item.draft,
        state.funding.calendar,
      ),
    ),
  }
}

function knockOnsOf(
  inputs: PlannerInputs,
  state: PlannerState,
  after: PlannerInputs,
  stateAfter: PlannerState,
  today: string,
): KnockOn[] {
  const out: KnockOn[] = []
  const billsBefore = billStatuses(inputs, state, today)
  const billsAfter = billStatuses(after, stateAfter, today)
  for (const b of inputs.bills) {
    if (b.closedAt !== null) continue
    const { shortBy, occurrence } = billsAfter[b.id]
    if (shortBy > billsBefore[b.id].shortBy + EPS)
      out.push({
        kind: 'bill',
        id: b.id,
        name: b.name,
        currency: b.currency,
        change: 'short',
        shortBy,
        deadline: occurrence,
      })
  }
  const goalsBefore = goalStatuses(inputs, state, today)
  const goalsAfter = goalStatuses(after, stateAfter, today)
  for (const g of inputs.goals) {
    if (g.closedAt !== null || g.pausedAt !== null) continue
    const was = goalsBefore[g.id]
    const now = goalsAfter[g.id]
    const who = { kind: 'goal' as const, id: g.id, name: g.name, currency: g.currency }
    if (now.shortBy > was.shortBy + EPS)
      out.push({
        ...who,
        change: 'short',
        shortBy: now.shortBy,
        deadline: g.dueDate,
      })
    else if (was.finish && now.finish && now.finish > was.finish)
      out.push({ ...who, change: 'later', from: was.finish, to: now.finish })
    else if (now.perPaycheck < was.perPaycheck - EPS)
      out.push({
        ...who,
        change: 'slower',
        from: was.perPaycheck,
        to: now.perPaycheck,
      })
  }
  return out
}

const pictureOf = (inputs: PlannerInputs, state: PlannerState): PlanPicture => {
  const paycheck = eachPaycheck(inputs, state)
  return { paycheck, verdict: verdictOf(inputs, state, paycheck) }
}

export function whatIf(args: {
  inputs: PlannerInputs
  state: PlannerState
  items: ReadonlyArray<WhatIfItem>
  userId: string
  today: Date
}): WhatIfResult {
  const { inputs, state, items, userId, today } = args
  const iso = isoOf(today)
  const after = inputsWith(inputs, items)
  const stateAfter = derivePlannerState(after, userId, today)
  return {
    before: pictureOf(inputs, state),
    after: pictureOf(after, stateAfter),
    items: items
      .filter((i) => i.on)
      .map((i) => outcomeOf(i, after, stateAfter, iso)),
    knockOns: knockOnsOf(inputs, state, after, stateAfter, iso),
  }
}
