/**
 * The planned rows the user's income, bills and goals call for right now — pure, and
 * deterministic down to the ids, so every device derives the same rows.
 *
 * - **Paydays**: each stream's paydays within the horizon, until its `endsOn`.
 * - **Bill payments**: one per occurrence from `nextDue` (an overdue one arrives already due)
 *   through the horizon, in the bill's wallet and category.
 * - **Set-asides** from the funding plan, one row per owner per payday: a goal with a target
 *   and a date gets its whole schedule (its stored plan); a bill gets every payday through
 *   its next occurrence's last one, and the horizon beyond; anything else rolls within the
 *   horizon. In Review mode they are generated flagged for the payday review.
 */
import type {
  LocalBill,
  LocalGoal,
  LocalIncomeStream,
  LocalPlanned,
} from '#/db/types'
import { paydaysOf } from '#/features/goals/data/paydays'
import {
  isDatedTargetGoal,
  roundedSchedule,
} from '#/features/planning/data/funding'
import type { FundingPlan, TrackPlan } from '#/features/planning/data/funding'
import {
  billOccurrences,
  paymentRowsByBill,
} from '#/features/planning/data/occurrences'
import type { PlannedOrigin, PlannedRole } from '#/features/planned/api/types'
import type { PaydayMode } from '#/features/wallets/api/types'
import type { CurrencyCode } from '#/lib/currency'
import { addDaysISO } from './dates'
import { plannedIdFor } from './ids'

export { paydaysOf }

/** A row as the generator wants it; persistence adds the timestamps and sync fields. */
export type DesiredPlanned = Omit<
  LocalPlanned,
  'createdAt' | 'updatedAt' | 'version' | 'dirty' | 'deleted'
>

export type GeneratorInput = {
  userId: string
  income: ReadonlyArray<LocalIncomeStream>
  bills: ReadonlyArray<LocalBill>
  goals: ReadonlyArray<LocalGoal>
  /** The stored rows — a bill's payment rows keep its schedule on its day. */
  planned: ReadonlyArray<LocalPlanned>
  funding: FundingPlan
  paydayMode: PaydayMode
  /** ISO date. */
  today: string
  horizonDays?: number
}

/** How far ahead rolling origins (paydays, bills, open-ended goals) are planned. */
export const HORIZON_DAYS = 90

type RowSeed = {
  origin: PlannedOrigin
  originId: string
  role: PlannedRole
  occurrence: string
  amount: number
  currency: CurrencyCode
  name: string
  walletId?: string | null
  categoryId?: string | null
  review?: boolean
}

const rowFor = (userId: string, seed: RowSeed): DesiredPlanned => ({
  id: plannedIdFor(
    userId,
    seed.origin,
    seed.originId,
    seed.role,
    seed.occurrence,
  ),
  origin: seed.origin,
  role: seed.role,
  goalId: seed.origin === 'goal' ? seed.originId : null,
  incomeStreamId: seed.origin === 'income' ? seed.originId : null,
  billId: seed.origin === 'bill' ? seed.originId : null,
  walletId: seed.walletId ?? null,
  name: seed.name,
  amount: Math.max(0, Math.round(seed.amount)),
  currency: seed.currency,
  categoryId: seed.categoryId ?? null,
  occurrence: seed.occurrence,
  date: seed.occurrence,
  status: 'open',
  pinned: false,
  review: seed.review ?? false,
  note: null,
})

function incomeRows(
  stream: LocalIncomeStream,
  from: string,
  to: string,
): RowSeed[] {
  const until = stream.endsOn && stream.endsOn < to ? stream.endsOn : to
  return paydaysOf(stream, from, until).map((date) => ({
    origin: 'income',
    originId: stream.id,
    role: 'income',
    occurrence: date,
    amount: stream.amount,
    currency: stream.currency,
    name: stream.label,
    walletId: stream.walletId,
  }))
}

const paymentRows = (
  bill: LocalBill,
  payments: ReadonlyMap<string, LocalPlanned>,
  until: string,
): RowSeed[] =>
  billOccurrences(bill, payments, until).map((due) => ({
    origin: 'bill',
    originId: bill.id,
    role: 'payment',
    occurrence: due,
    amount: bill.amount,
    currency: bill.currency,
    name: bill.name,
    walletId: bill.walletId,
    categoryId: bill.categoryId,
  }))

/** Σ of an owner's tracks per slot, each track rounded so it adds up exactly. */
function perSlot(tracks: ReadonlyArray<TrackPlan>, slots: number): number[] {
  const out = new Array<number>(slots).fill(0)
  for (const t of tracks)
    roundedSchedule(t.funded).forEach((amount, k) => (out[k] += amount))
  return out
}

function groupTracks(plan: FundingPlan): Map<string, TrackPlan[]> {
  const out = new Map<string, TrackPlan[]>()
  for (const t of plan.tracks) {
    const key = `${t.kind}:${t.ownerId}`
    const list = out.get(key)
    if (list) list.push(t)
    else out.set(key, [t])
  }
  for (const list of out.values())
    list.sort((a, b) => (a.occurrence ?? '').localeCompare(b.occurrence ?? ''))
  return out
}

function setAsideRows(input: GeneratorInput, until: string): RowSeed[] {
  const { funding } = input
  const review = input.paydayMode === 'review'
  const goals = new Map(input.goals.map((g) => [g.id, g]))
  const bills = new Map(input.bills.map((b) => [b.id, b]))
  const seeds: RowSeed[] = []

  for (const tracks of groupTracks(funding).values()) {
    const { kind, ownerId, currency } = tracks[0]
    const goal = kind === 'goal' ? goals.get(ownerId) : undefined
    const bill = kind === 'bill' ? bills.get(ownerId) : undefined
    const owner = goal ?? bill
    if (!owner) continue
    // A bill plans its next occurrence whole; a dated goal its whole schedule.
    const lastSlot = bill
      ? tracks[0].end
      : goal && isDatedTargetGoal(goal)
        ? funding.slots.length - 1
        : -1
    perSlot(tracks, funding.slots.length).forEach((amount, k) => {
      const date = funding.slots[k].date
      if (amount <= 0 || (date > until && k > lastSlot)) return
      seeds.push({
        origin: kind,
        originId: ownerId,
        role: 'set_aside',
        occurrence: date,
        amount,
        currency,
        name: `${owner.name} set-aside`,
        walletId: goal
          ? goal.saveWalletId
          : (bill?.saveWalletId ?? bill?.walletId ?? null),
        review,
      })
    })
  }
  return seeds
}

export function desiredPlanned(input: GeneratorInput): DesiredPlanned[] {
  const { today } = input
  const until = addDaysISO(today, input.horizonDays ?? HORIZON_DAYS)
  const seeds: RowSeed[] = []
  for (const stream of input.income)
    seeds.push(...incomeRows(stream, today, until))
  const payments = paymentRowsByBill(input.planned)
  for (const bill of input.bills)
    seeds.push(
      ...paymentRows(bill, payments.get(bill.id) ?? new Map(), until),
    )
  seeds.push(...setAsideRows(input, until))
  return seeds.map((seed) => rowFor(input.userId, seed))
}
