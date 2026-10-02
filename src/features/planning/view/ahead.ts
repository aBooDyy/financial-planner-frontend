/**
 * Balance ahead (Upcoming's rail, 03 §9): every active wallet together, day by day for 30
 * days — the Balance as payments and paydays land, and Free to spend beside it. A payment
 * releases what its own occurrence had set aside (F8), so paying a bill that was saved for
 * never reads as dipping into set-aside money; a planned set-aside earmarks more. Pure.
 */
import { addDaysISO, daysBetween } from '#/features/planned/data/dates'
import type { UpcomingRow } from '#/features/planning/data/upcoming'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { dayMonth, money } from './format'

export const AHEAD_DAYS = 30

export type AheadDay = {
  date: string
  balance: number
  setAside: number
  free: number
}

export type BalanceAhead = {
  days: AheadDay[]
  /** Day indexes a payday lands on. */
  paydays: number[]
  /** The day Free to spend is lowest. */
  low: number
  note: string
}

export function balanceAhead(args: {
  rows: ReadonlyArray<UpcomingRow>
  /** Base currency, active wallets, now. */
  balance: number
  setAside: number
  base: CurrencyCode
  rates: RatesMap
  today: string
}): BalanceAhead {
  const { base, rates, today } = args
  const inBase = (amount: number, currency: string) =>
    convertMinor(amount, currency, base, rates)
  const byDay = new Map<number, UpcomingRow[]>()
  for (const r of args.rows) {
    if (r.remainder <= 0) continue
    const day = Math.max(0, daysBetween(today, r.item.date))
    if (day > AHEAD_DAYS) continue
    byDay.set(day, [...(byDay.get(day) ?? []), r])
  }

  let balance = args.balance
  let setAside = args.setAside
  const days: AheadDay[] = []
  const paydays: number[] = []
  for (let d = 0; d <= AHEAD_DAYS; d++) {
    for (const r of byDay.get(d) ?? []) {
      const amount = inBase(r.remainder, r.currency)
      if (r.item.role === 'income') {
        balance += amount
        if (!paydays.includes(d)) paydays.push(d)
      } else if (r.item.role === 'payment') {
        balance -= amount
        const own = inBase(r.coverage?.setAside ?? 0, r.currency)
        setAside -= Math.min(own, amount)
      } else setAside += amount
    }
    days.push({
      date: addDaysISO(today, d),
      balance,
      setAside,
      free: balance - setAside,
    })
  }
  const low = days.reduce(
    (at, day, i) => (day.free < days[at].free ? i : at),
    0,
  )
  const short = days.findIndex((day) => day.free < 0)
  const lowDay = days[low]
  const beforePay = paydays.includes(low + 1)
  const note =
    short >= 0
      ? `Free to spend goes below zero on ${dayMonth(days[short].date)} — ${money(-lowDay.free, base)} short at its lowest.`
      : `Free to spend is lowest on ${dayMonth(lowDay.date)} at ${money(lowDay.free, base)}${beforePay ? ', just before pay arrives' : ''}.`
  return { days, paydays, low, note }
}
