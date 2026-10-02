/**
 * The payday review (03 §4): the set-asides a payday's paycheck should make, grouped Bills
 * before next payday · Saving up · Goals, in plan priority, with the transfer each other
 * wallet needs. Pure; the sheet edits the lines and `transfersFor` re-totals them.
 */
import type { LocalPlanned } from '#/db/types'
import { remainderOf } from '#/features/planned/data/settle'
import type { PlannerInputs, PlannerState } from '#/features/planned/data/state'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { occurrenceFrom, paymentRowsByBill } from './occurrences'
import { periodOf } from './payPeriods'
import type { PayPeriod } from './payPeriods'

export type ReviewGroupKey = 'bills_before_payday' | 'saving_up' | 'goals'

export type ReviewLine = {
  plannedId: string
  group: ReviewGroupKey
  kind: 'bill' | 'goal'
  ownerId: string
  /** The bill's or goal's name. */
  name: string
  color: string
  /** Still to set aside, in `currency` (the row's). */
  amount: number
  currency: CurrencyCode
  /** Where it is planned to go; null = choose one. */
  walletId: string | null
  /** A bill's: the occurrence it goes toward. A goal's: its date, if any. */
  dueDate: string | null
  /** In the sheet's review queue (vs. only open). */
  waiting: boolean
}

export type ReviewGroup = {
  key: ReviewGroupKey
  lines: ReviewLine[]
  total: number
}

export type PaydayReview = {
  /** The payday (period start) these set-asides belong to. */
  payday: string
  period: PayPeriod
  /** The main paycheck's wallet — where the money lands. */
  depositWalletId: string | null
  groups: ReviewGroup[]
  /** Σ lines, base currency. */
  total: number
  /** Ticked-by-default transfers: one per other wallet. */
  transfers: TransferLine[]
}

export type TransferLine = {
  toWalletId: string
  /** In the deposit wallet's currency. */
  amount: number
}

const GROUP_ORDER: ReviewGroupKey[] = [
  'bills_before_payday',
  'saving_up',
  'goals',
]

/** Plan priority of a line: must-pay bills, must-have goals, the rest; then by date, position. */
function rankOf(
  line: ReviewLine,
  inputs: PlannerInputs,
): [number, string, number] {
  if (line.kind === 'bill') {
    const bill = inputs.bills.find((b) => b.id === line.ownerId)
    return [
      bill?.mustPay === false ? 3 : 1,
      line.dueDate ?? '',
      bill?.position ?? 0,
    ]
  }
  const goal = inputs.goals.find((g) => g.id === line.ownerId)
  return [
    goal?.mustHave ? 2 : 3,
    goal?.dueDate ?? '9999-12-31',
    goal?.position ?? 0,
  ]
}

/** Transfers the ticked lines need: Σ per wallet other than the deposit one. */
export function transfersFor(
  lines: ReadonlyArray<
    Pick<ReviewLine, 'walletId' | 'amount' | 'currency'> & { ticked?: boolean }
  >,
  depositWalletId: string | null,
  depositCurrency: CurrencyCode,
  rates: RatesMap,
): TransferLine[] {
  const by = new Map<string, number>()
  for (const l of lines) {
    if (l.ticked === false || !l.walletId || l.walletId === depositWalletId)
      continue
    by.set(
      l.walletId,
      (by.get(l.walletId) ?? 0) +
        convertMinor(l.amount, l.currency, depositCurrency, rates),
    )
  }
  return [...by.entries()]
    .map(([toWalletId, amount]) => ({ toWalletId, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export type ReviewOptions = {
  /** ISO date. */
  today: string
  /** Wallet currencies, for the transfer amounts. */
  walletCurrency: ReadonlyMap<string, CurrencyCode>
}

function lineOf(
  p: LocalPlanned,
  period: PayPeriod,
  inputs: PlannerInputs,
  state: PlannerState,
  payments: ReadonlyMap<string, ReadonlyMap<string, LocalPlanned>>,
): ReviewLine | null {
  const amount = remainderOf(p, state.index, inputs.rates)
  if (amount <= 0) return null
  if (p.billId) {
    const bill = inputs.bills.find((b) => b.id === p.billId)
    if (!bill || bill.closedAt !== null) return null
    const due = occurrenceFrom(bill, p.date, payments.get(bill.id) ?? new Map())
    return {
      plannedId: p.id,
      group:
        due !== null && due <= period.end ? 'bills_before_payday' : 'saving_up',
      kind: 'bill',
      ownerId: bill.id,
      name: bill.name,
      color: bill.color,
      amount,
      currency: p.currency,
      walletId: p.walletId,
      dueDate: due,
      waiting: p.review,
    }
  }
  const goal = inputs.goals.find((g) => g.id === p.goalId)
  if (!goal || goal.closedAt !== null || goal.pausedAt !== null) return null
  return {
    plannedId: p.id,
    group: 'goals',
    kind: 'goal',
    ownerId: goal.id,
    name: goal.name,
    color: goal.color,
    amount,
    currency: p.currency,
    walletId: p.walletId,
    dueDate: goal.dueDate,
    waiting: p.review,
  }
}

/**
 * One payday's review: its period's open set-asides (`waitingOnly`: just those waiting in the
 * review queue).
 */
export function paydayReview(
  inputs: PlannerInputs,
  state: PlannerState,
  payday: string,
  options: ReviewOptions & { waitingOnly?: boolean },
): PaydayReview {
  const calendar = state.funding.calendar
  const period = periodOf(calendar, payday)
  const payments = paymentRowsByBill(inputs.planned)
  const lines = inputs.planned
    .filter(
      (p) =>
        p.deleted === 0 &&
        p.status === 'open' &&
        p.role === 'set_aside' &&
        p.date >= period.start &&
        p.date <= period.end &&
        (!options.waitingOnly || p.review),
    )
    .map((p) => lineOf(p, period, inputs, state, payments))
    .filter((l): l is ReviewLine => l !== null)
  const rank = (a: ReviewLine, b: ReviewLine) => {
    const [ta, da, pa] = rankOf(a, inputs)
    const [tb, db, pb] = rankOf(b, inputs)
    return (
      ta - tb || da.localeCompare(db) || pa - pb || a.name.localeCompare(b.name)
    )
  }
  const groups = GROUP_ORDER.map((key) => {
    const list = lines.filter((l) => l.group === key).sort(rank)
    return {
      key,
      lines: list,
      total: list.reduce(
        (sum, l) =>
          sum + convertMinor(l.amount, l.currency, inputs.base, inputs.rates),
        0,
      ),
    }
  }).filter((g) => g.lines.length > 0)
  const depositWalletId =
    calendar.kind === 'paycheck' ? calendar.stream.walletId : null
  return {
    payday: period.start,
    period,
    depositWalletId,
    groups,
    total: groups.reduce((sum, g) => sum + g.total, 0),
    transfers: transfersFor(
      lines,
      depositWalletId,
      (depositWalletId && options.walletCurrency.get(depositWalletId)) ||
        inputs.base,
      inputs.rates,
    ),
  }
}

/** Every payday with set-asides waiting in the review queue, oldest first. */
export function waitingReviews(
  inputs: PlannerInputs,
  state: PlannerState,
  options: ReviewOptions,
): PaydayReview[] {
  const calendar = state.funding.calendar
  const paydays = new Set(
    inputs.planned
      .filter(
        (p) =>
          p.deleted === 0 &&
          p.status === 'open' &&
          p.role === 'set_aside' &&
          p.review &&
          p.date <= options.today,
      )
      .map((p) => periodOf(calendar, p.date).start),
  )
  return [...paydays]
    .sort()
    .map((payday) =>
      paydayReview(inputs, state, payday, { ...options, waitingOnly: true }),
    )
    .filter((r) => r.groups.length > 0)
}

/** How many lines wait in the review queue — the "Review · N" badge. */
export const reviewCount = (reviews: ReadonlyArray<PaydayReview>): number =>
  reviews.reduce(
    (sum, r) => sum + r.groups.reduce((n, g) => n + g.lines.length, 0),
    0,
  )
