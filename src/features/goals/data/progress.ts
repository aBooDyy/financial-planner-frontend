/**
 * How much of a goal is done, and how much of its money is still spoken for.
 *
 * A goal is raised two ways: **set-asides** (reservations — the money stays in its wallet,
 * marked for the goal) and **payments** (goal-linked spends — the money leaves). Paying for
 * the goal consumes what was set aside for it, so the two never add up:
 *
 *   progress      = max(reserved, spent)
 *   stillReserved = max(0, reserved − spent)
 *
 * Saved 13,000 then paid 13,000 → progress 13,000, nothing reserved. Saved 5,000 and paid a
 * 1,000 deposit → progress 5,000, 4,000 still reserved. A payment releases the reservation
 * in its own wallet first, then the others' largest first. Recurring obligations apply the
 * rule per cycle — last year's rent must not offset this year's set-asides.
 *
 * All amounts are minor units in the goal's currency.
 */
import type {
  LocalGoal,
  LocalGoalAllocation,
  LocalPlanned,
  LocalTransaction,
} from '#/db/types'
import { convertMinor } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { RECURRING_KINDS } from '#/features/goals/constants'
import { approxCyclesBetween, frequencyMetaOf, stepDue } from './cadence'
import { parseISO, ymd } from './planning'

export type GoalProgress = {
  /** Set aside toward the goal (this cycle, for a recurring obligation). */
  reserved: number
  /** Paid toward the goal (this cycle, for a recurring obligation). */
  spent: number
  /** `max(reserved, spent)` — what the goal counts as done beyond its stored baseline. */
  progress: number
  /** Reservations not yet consumed by a payment, across every cycle. */
  stillReserved: number
  /** `stillReserved` per wallet it sits in. */
  byWallet: Partial<Record<string, number>>
  /** `stillReserved` held outside any wallet (a named external source). */
  external: number
}

const EXTERNAL = '\u0000external'

type Entry = { date: string; amount: number; source: string }

/** Where each set-aside / payment falls, and the rule that buckets them into cycles. */
type Cycles = {
  /** Which cycle a reservation made on `date` funds: the first due strictly after it. */
  ofReservation: (date: string) => string
  /** Which cycle a payment made on `date` pays: the first due on or after it. */
  ofPayment: (date: string) => string
  current: string
}

const ONE_CYCLE: Cycles = {
  ofReservation: () => '',
  ofPayment: () => '',
  current: '',
}

/** The due series of a recurring obligation, anchored on its `nextDue` in both directions. */
function cyclesOf(g: LocalGoal, today: Date): Cycles {
  if (!RECURRING_KINDS.includes(g.kind) || !g.nextDue) return ONE_CYCLE
  const anchor = parseISO(g.nextDue, today)
  const { cadence } = frequencyMetaOf(g)
  const dueAt = (j: number): string => ymd(stepDue(anchor, cadence, j))
  const firstDue = (date: string, strict: boolean): string => {
    const reached = (due: string) => (strict ? due > date : due >= date)
    let j = approxCyclesBetween(anchor, parseISO(date, today), cadence)
    while (!reached(dueAt(j))) j += 1
    while (reached(dueAt(j - 1))) j -= 1
    return dueAt(j)
  }
  return {
    ofReservation: (date) => firstDue(date, true),
    ofPayment: (date) => firstDue(date, false),
    current: firstDue(ymd(today), false),
  }
}

/**
 * Consume `payments` out of `reservations` (per source): each payment takes from its own
 * wallet first, then from whichever source still holds the most. Returns what is left.
 */
function release(
  reservations: ReadonlyArray<Entry>,
  payments: ReadonlyArray<Entry>,
): Map<string, number> {
  const left = new Map<string, number>()
  for (const r of reservations)
    left.set(r.source, (left.get(r.source) ?? 0) + r.amount)
  for (const p of payments) {
    let owed = p.amount
    const take = (source: string) => {
      const have = left.get(source) ?? 0
      const used = Math.min(have, owed)
      left.set(source, have - used)
      owed -= used
    }
    take(p.source)
    while (owed > 0) {
      const [source, have] = [...left.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [null, 0]
      if (!source || have <= 0) break
      take(source)
    }
  }
  return left
}

const sum = (entries: ReadonlyArray<Entry>): number =>
  entries.reduce((a, e) => a + e.amount, 0)

/** Keyed by goal id; a goal missing from the input is missing here. */
export type GoalProgressMap = Partial<Record<string, GoalProgress>>

/** Progress and still-reserved money for every goal, keyed by goal id. */
export function goalProgress(
  goals: ReadonlyArray<LocalGoal>,
  allocations: ReadonlyArray<LocalGoalAllocation>,
  txns: ReadonlyArray<LocalTransaction>,
  rates: RatesMap,
  today: Date,
  // A settlement linked to a planned row belongs to that row's occurrence, not its own date,
  // so a rent paid three days late still pays the cycle it was due in.
  planned: ReadonlyArray<LocalPlanned> = [],
): GoalProgressMap {
  const occurrenceOf = new Map(planned.map((p) => [p.id, p.occurrence]))
  const out: GoalProgressMap = {}

  for (const g of goals) {
    const cycles = cyclesOf(g, today)
    const inGoal = (amount: number, currency: string) =>
      convertMinor(amount, currency, g.currency, rates)
    const dateOf = (plannedId: string | null, own: string) =>
      (plannedId && occurrenceOf.get(plannedId)) || own

    const reservations = allocations
      .filter((a) => a.deleted === 0 && a.goalId === g.id)
      .map((a) => ({
        cycle: cycles.ofReservation(dateOf(a.plannedId, a.date)),
        entry: {
          date: a.date,
          amount: inGoal(a.amount, a.currency),
          source: a.source === 'wallet' && a.walletId ? a.walletId : EXTERNAL,
        },
      }))
    const payments = txns
      .filter((t) => t.deleted === 0 && t.goalId === g.id && t.type === 'spend')
      .map((t) => ({
        cycle: cycles.ofPayment(dateOf(t.plannedId, t.date)),
        entry: {
          date: t.date,
          amount: inGoal(t.amount, t.currency),
          source: t.walletId,
        },
      }))

    const buckets = new Set([
      ...reservations.map((r) => r.cycle),
      ...payments.map((p) => p.cycle),
    ])
    const byWallet: Partial<Record<string, number>> = {}
    let inWallets = 0
    let external = 0
    for (const cycle of buckets) {
      const left = release(
        reservations.filter((r) => r.cycle === cycle).map((r) => r.entry),
        payments.filter((p) => p.cycle === cycle).map((p) => p.entry),
      )
      for (const [source, amount] of left) {
        if (amount <= 0) continue
        if (source === EXTERNAL) {
          external += amount
        } else {
          byWallet[source] = (byWallet[source] ?? 0) + amount
          inWallets += amount
        }
      }
    }

    const reserved = sum(
      reservations
        .filter((r) => r.cycle === cycles.current)
        .map((r) => r.entry),
    )
    const spent = sum(
      payments.filter((p) => p.cycle === cycles.current).map((p) => p.entry),
    )
    out[g.id] = {
      reserved,
      spent,
      progress: Math.max(reserved, spent),
      stillReserved: external + inWallets,
      byWallet,
      external,
    }
  }
  return out
}

/** Just the progress figure per goal — what the funding engine adds to each baseline. */
export const progressByGoal = (
  progress: GoalProgressMap,
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(progress).map(([id, p]) => [id, p?.progress ?? 0]),
  )
