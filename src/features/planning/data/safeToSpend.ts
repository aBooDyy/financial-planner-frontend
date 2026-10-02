/**
 * Safe to spend (03 §8), base currency over active wallets:
 *
 *   Safe(H) = Σ Free to spend
 *           − Σ bill payments due by H that are not already set aside
 *           − Σ planned set-asides due by H (for what falls due after H)
 *           + Σ income expected tomorrow … H
 *
 * H is `safeHorizonEnd` (until the day before the next main payday by default). Payments and
 * set-asides already overdue count too: until confirmed, that money is still in the free
 * figure. A bill set-aside whose occurrence falls due within H is left out — its payment is
 * already counted, and counting both would take the money twice. A closed bill's or a closed or
 * paused goal's rows count for nothing. Budgets are never subtracted (D18). Pure.
 */
import type {
  LocalBill,
  LocalGoal,
  LocalPlanned,
  LocalSetAside,
} from '#/db/types'
import { remainderOf } from '#/features/planned/data/settle'
import type { SettlementIndex } from '#/features/planned/data/settle'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import type {
  PlanningSettings,
  SafeHorizon,
} from '#/features/wallets/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import type { MoneyFigures } from './balances'
import { isStoppedOwner } from './funding'
import { occurrenceFrom, paymentRowsByBill } from './occurrences'
import { paydayAfter, safeHorizonEnd } from './payPeriods'
import type { PayCalendar } from './payPeriods'

/** One planned row the arithmetic counts, base currency. */
export type SafeLine = {
  plannedId: string
  billId: string | null
  goalId: string | null
  name: string
  date: string
  amount: number
}

export type SafeTerm = { total: number; items: SafeLine[] }

export type SafeToSpend = {
  horizon: SafeHorizon
  /** The last day looked at (inclusive). */
  end: string
  /** The next main payday, when the window runs until it. */
  payday: string | null
  balance: number
  setAside: number
  free: number
  /** Bill payments due by the end, less what is set aside for them. */
  bills: SafeTerm
  /** Planned set-asides due by the end. */
  setAsides: SafeTerm
  /** Income expected after today, by the end. */
  income: SafeTerm
  safe: number
  /** How far below zero Safe to spend is; 0 when it isn't. */
  shortBy: number
}

export type SafeToSpendInput = {
  /** The header figures (`balanceFigures(...).header`). */
  header: MoneyFigures
  planned: ReadonlyArray<LocalPlanned>
  index: SettlementIndex
  setAsides: ReadonlyArray<LocalSetAside>
  bills: ReadonlyArray<LocalBill>
  goals: ReadonlyArray<LocalGoal>
  settings: Pick<PlanningSettings, 'safeHorizon' | 'safeHorizonDays'>
  calendar: PayCalendar
  /** ISO date. */
  today: string
  base: CurrencyCode
  rates: RatesMap
}

const term = (items: SafeLine[]): SafeTerm => ({
  total: items.reduce((sum, l) => sum + l.amount, 0),
  items,
})

export function safeToSpend(input: SafeToSpendInput): SafeToSpend {
  const { today, base, rates, index } = input
  const end = safeHorizonEnd(input.settings, input.calendar, today)
  const bills = new Map(input.bills.map((b) => [b.id, b]))
  const goals = new Map(input.goals.map((g) => [g.id, g]))
  const payments = paymentRowsByBill(input.planned)
  const inBase = (amount: number, currency: CurrencyCode) =>
    convertMinor(amount, currency, base, rates)
  const line = (p: LocalPlanned, amount: number): SafeLine => ({
    plannedId: p.id,
    billId: p.billId,
    goalId: p.goalId,
    name: p.name,
    date: p.date,
    amount: inBase(amount, p.currency),
  })
  const heldFor = (
    billId: string,
    occurrence: string,
    currency: CurrencyCode,
  ) =>
    input.setAsides
      .filter(
        (a) =>
          isLiveSetAside(a) &&
          a.billId === billId &&
          a.occurrence === occurrence,
      )
      .reduce(
        (sum, a) => sum + convertMinor(a.amount, a.currency, currency, rates),
        0,
      )

  const open = input.planned.filter(
    (p) =>
      p.deleted === 0 &&
      p.status === 'open' &&
      p.date <= end &&
      !isStoppedOwner(p, bills, goals),
  )
  const billLines: SafeLine[] = []
  const setAsideLines: SafeLine[] = []
  const incomeLines: SafeLine[] = []
  for (const p of open) {
    const left = remainderOf(p, index, rates)
    if (left <= 0) continue
    if (p.role === 'payment') {
      const held =
        p.billId && p.origin === 'bill'
          ? heldFor(p.billId, p.occurrence, p.currency)
          : 0
      const uncovered = Math.max(0, left - held)
      if (uncovered > 0) billLines.push(line(p, uncovered))
    } else if (p.role === 'income') {
      if (p.date > today) incomeLines.push(line(p, left))
    } else {
      const bill = p.billId ? bills.get(p.billId) : undefined
      const covers = bill
        ? occurrenceFrom(bill, p.date, payments.get(bill.id) ?? new Map())
        : null
      if (covers !== null && covers <= end) continue
      setAsideLines.push(line(p, left))
    }
  }

  const byDate = (a: SafeLine, b: SafeLine) =>
    a.date.localeCompare(b.date) || a.name.localeCompare(b.name)
  const billsTerm = term(billLines.sort(byDate))
  const setAsidesTerm = term(setAsideLines.sort(byDate))
  const incomeTerm = term(incomeLines.sort(byDate))
  const safe =
    input.header.free - billsTerm.total - setAsidesTerm.total + incomeTerm.total
  const payday =
    input.settings.safeHorizon === 'until_payday' &&
    input.calendar.kind === 'paycheck'
      ? paydayAfter(input.calendar, today)
      : null
  return {
    horizon: input.settings.safeHorizon,
    end,
    payday,
    balance: input.header.balance,
    setAside: input.header.setAside,
    free: input.header.free,
    bills: billsTerm,
    setAsides: setAsidesTerm,
    income: incomeTerm,
    safe,
    shortBy: Math.max(0, -safe),
  }
}
