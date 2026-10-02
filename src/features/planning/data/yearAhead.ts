/**
 * Year ahead (04 §5): every commitment on one month axis. Per month: income, the monthly-bill
 * total, the bills saved up for (markers on their due month), goal targets falling due, and
 * the set-asides the plan makes (stacked per bill or goal). Alongside: each saved-up bill
 * occurrence's ramp, and each goal's bar to its projected finish — slipping past its date when
 * the plan can't make it. Base currency unless a field says otherwise. Pure.
 */
import type { PlannerInputs, PlannerState } from '#/features/planned/data/state'
import { addDaysISO, addMonthsISO } from '#/features/planned/data/dates'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { convertMinor } from '#/lib/currency'
import { roundedSchedule, tracksOf } from './funding'
import type { OwnerKind } from './funding'
import { billOccurrences, paymentRowsByBill } from './occurrences'
import { incomeBetween } from './payPeriods'
import { cycleOf, goalStatusOf } from './status'

export type YearBill = {
  billId: string
  occurrence: string
  /** Bill currency, and base. */
  amount: number
  amountBase: number
}

export type YearSetAside = {
  kind: OwnerKind
  ownerId: string
  color: string
  amount: number
}

export type YearMonth = {
  /** `YYYY-MM`. */
  month: string
  /** What the income streams bring in. */
  income: number
  /** Bills covered from each paycheck: their occurrences this month. */
  monthlyBills: { total: number; items: YearBill[] }
  /** Bills saved up for, due this month — the markers. */
  bigBills: YearBill[]
  /** Goals whose date falls this month. */
  goalTargets: string[]
  /** What the plan sets aside on this month's paydays, largest first. */
  setAside: { total: number; byOwner: YearSetAside[] }
}

export type YearRamp = {
  billId: string
  occurrence: string
  /** The first payday it saves on. */
  from: string
  /** Bill currency: the occurrence's amount, what is set aside now, and the steady installment. */
  amount: number
  setAside: number
  perPaycheck: number
}

export type YearGoal = {
  goalId: string
  /** The first payday the plan sets aside for it; null when it sets aside nothing. */
  from: string | null
  /** When the plan reaches its target; null without one, or out of reach. */
  finish: string | null
  /** Its own date, if it has one. */
  target: string | null
  /** Won't make its date: `slipsTo` is roughly when it would. */
  slips: boolean
  slipsTo: string | null
  paused: boolean
  /** Goal currency, at the next payday. */
  perPaycheck: number
}

export type YearAhead = {
  months: YearMonth[]
  ramps: YearRamp[]
  goals: YearGoal[]
}

const monthOf = (iso: string) => iso.slice(0, 7)

export function buildYearAhead(
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
  options: { months?: number } = {},
): YearAhead {
  const { base, rates } = inputs
  const { funding } = state
  const toBase = (amount: number, currency: string) =>
    convertMinor(amount, currency, base, rates)

  // Twelve months, stretched to the latest goal date.
  let count = options.months ?? 12
  for (const g of inputs.goals) {
    if (!g.dueDate || g.closedAt !== null) continue
    const months =
      (Number(g.dueDate.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
      Number(g.dueDate.slice(5, 7)) -
      Number(today.slice(5, 7)) +
      1
    count = Math.max(count, months)
  }
  const first = `${monthOf(today)}-01`
  const keys = Array.from({ length: count }, (_, i) =>
    monthOf(addMonthsISO(first, i)),
  )
  const last = addDaysISO(addMonthsISO(first, count), -1)
  const months = new Map<string, YearMonth>(
    keys.map((month) => [
      month,
      {
        month,
        income: incomeBetween(
          inputs.income,
          `${month}-01`,
          addDaysISO(addMonthsISO(`${month}-01`, 1), -1),
          base,
          rates,
        ),
        monthlyBills: { total: 0, items: [] },
        bigBills: [],
        goalTargets: [],
        setAside: { total: 0, byOwner: [] },
      },
    ]),
  )

  const ramps: YearRamp[] = []
  const payments = paymentRowsByBill(inputs.planned)
  for (const bill of inputs.bills) {
    if (bill.closedAt !== null) continue
    const tracks = tracksOf(funding, 'bill', bill.id)
    const savedUp = cycleOf(bill, tracks.at(0), funding) === 'save_up'
    for (const occurrence of billOccurrences(
      bill,
      payments.get(bill.id) ?? new Map(),
      last,
    )) {
      const month = months.get(monthOf(occurrence))
      if (!month) continue
      const line = {
        billId: bill.id,
        occurrence,
        amount: bill.amount,
        amountBase: toBase(bill.amount, bill.currency),
      }
      if (savedUp) month.bigBills.push(line)
      else {
        month.monthlyBills.items.push(line)
        month.monthlyBills.total += line.amountBase
      }
    }
    if (!savedUp) continue
    for (const t of tracks) {
      if (t.end < t.start || !t.occurrence || t.occurrence > last) continue
      const schedule = roundedSchedule(t.funded)
      ramps.push({
        billId: bill.id,
        occurrence: t.occurrence,
        from: funding.slots[t.start].date,
        amount: bill.amount,
        setAside: inputs.setAsides
          .filter(
            (a) =>
              isLiveSetAside(a) &&
              a.billId === bill.id &&
              a.occurrence === t.occurrence,
          )
          .reduce(
            (sum, a) =>
              sum + convertMinor(a.amount, a.currency, bill.currency, rates),
            0,
          ),
        perPaycheck: schedule.slice(t.start, t.end + 1).find((x) => x > 0) ?? 0,
      })
    }
  }

  const colors = new Map<string, string>([
    ...inputs.bills.map((b): [string, string] => [`bill:${b.id}`, b.color]),
    ...inputs.goals.map((g): [string, string] => [`goal:${g.id}`, g.color]),
  ])
  for (const t of funding.tracks) {
    const key = `${t.kind}:${t.ownerId}`
    roundedSchedule(t.funded).forEach((amount, k) => {
      if (amount <= 0) return
      const month = months.get(monthOf(funding.slots[k].date))
      if (!month) return
      const inBase = toBase(amount, t.currency)
      month.setAside.total += inBase
      const held = month.setAside.byOwner.find(
        (o) => o.kind === t.kind && o.ownerId === t.ownerId,
      )
      if (held) held.amount += inBase
      else
        month.setAside.byOwner.push({
          kind: t.kind,
          ownerId: t.ownerId,
          color: colors.get(key) ?? '',
          amount: inBase,
        })
    })
  }
  for (const month of months.values())
    month.setAside.byOwner.sort((a, b) => b.amount - a.amount)

  const goals: YearGoal[] = []
  for (const g of inputs.goals) {
    if (g.closedAt !== null) continue
    if (g.dueDate) months.get(monthOf(g.dueDate))?.goalTargets.push(g.id)
    const status = goalStatusOf(g, inputs, state, today)
    const track = tracksOf(funding, 'goal', g.id).at(0)
    const firstSlot = track
      ? roundedSchedule(track.funded).findIndex((x) => x > 0)
      : -1
    goals.push({
      goalId: g.id,
      from: firstSlot >= 0 ? funding.slots[firstSlot].date : null,
      finish: status.finish ?? status.slipsTo,
      target: g.dueDate,
      slips: status.state === 'short',
      slipsTo: status.slipsTo,
      paused: g.pausedAt !== null,
      perPaycheck: status.perPaycheck,
    })
  }

  return { months: [...months.values()], ramps, goals }
}
