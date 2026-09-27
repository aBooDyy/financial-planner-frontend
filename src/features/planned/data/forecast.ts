/**
 * The Planned tab's balance forecast: every account together, day by day, as planned bills
 * and paydays land. Pure, so the card only draws it.
 */
import { formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { addDaysISO, daysBetween } from './dates'
import { OUTLOOK_DAYS, outlookRows, remainderInBase } from './outlook'
import { shortDate } from './views'
import type { PlannedRowView } from './views'

const NAMES_SHOWN = 2

const moneyStr = (minor: number, base: CurrencyCode): string =>
  minor < 0
    ? `−${formatMoneyRounded(-minor, base)}`
    : formatMoneyRounded(minor, base)

export type ForecastDay = {
  date: string
  /** End-of-day balance, in base currency. */
  balance: number
  balanceStr: string
  /** "Today", "Tomorrow", "Oct 14". */
  dateStr: string
  /** Signed net of what lands that day; empty on a quiet day. */
  deltaStr: string
  /** "Rent, Netflix and 2 more"; empty on a quiet day. */
  namesStr: string
}

/**
 * `short` — the accounts together drop below zero; `reserved` — they stay above zero but dip
 * under what they hold for goals; `clear` — neither.
 */
export type ForecastStatus = {
  kind: 'short' | 'reserved' | 'clear'
  text: string
}

export type ForecastView = {
  days: ForecastDay[]
  lowIndex: number
  /** Goal money held across the accounts today, in base; 0 when none. */
  reserved: number
  status: ForecastStatus
  /** The chart's vertical range, padded so the line never touches an edge. */
  lo: number
  hi: number
  /** No bill or payday lands in the window, so the line is flat. */
  isFlat: boolean
  ariaLabel: string
}

export type ForecastInput = {
  /** Open planned rows, as the Planned tab builds them. */
  rows: ReadonlyArray<PlannedRowView>
  /** Every live account's balance now, in base. */
  balance: number
  reserved: number
  base: CurrencyCode
  rates: RatesMap
  today: string
}

/** Set-asides earmark money without moving it, so only payments and income change a balance. */
const movesMoney = (r: PlannedRowView): boolean =>
  r.item.role === 'payment' || r.item.role === 'income'

const dayLabel = (index: number, date: string): string =>
  index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : shortDate(date)

const whenOf = (index: number, date: string): string =>
  index === 0 ? 'today' : `on ${shortDate(date)}`

function namesOf(rows: PlannedRowView[]): string {
  if (rows.length === 0) return ''
  const shown = rows.slice(0, NAMES_SHOWN).map((r) => r.name)
  const more = rows.length - shown.length
  return more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', ')
}

function statusOf(days: ForecastDay[], reserved: number): ForecastStatus {
  const short = days.findIndex((d) => d.balance < 0)
  if (short >= 0)
    return {
      kind: 'short',
      text: `Goes below zero ${whenOf(short, days[short].date)}`,
    }
  const dips = reserved > 0 ? days.findIndex((d) => d.balance < reserved) : -1
  if (dips >= 0)
    return {
      kind: 'reserved',
      text: `Dips into goal money ${whenOf(dips, days[dips].date)}`,
    }
  return {
    kind: 'clear',
    text: `No shortfall in the next ${OUTLOOK_DAYS} days`,
  }
}

function rangeOf(values: number[]): { lo: number; hi: number } {
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat line still needs height; give it a band around its value.
  const pad =
    max > min ? (max - min) * 0.12 : Math.max(Math.abs(max) * 0.1, 100)
  return { lo: min - pad, hi: max + pad }
}

export function buildForecast(input: ForecastInput): ForecastView {
  const { base, rates, today } = input
  const byDay = new Map<number, PlannedRowView[]>()
  for (const row of outlookRows(input.rows, today).filter(movesMoney)) {
    // Overdue items are owed now, so they land today.
    const index = Math.max(0, daysBetween(today, row.item.date))
    const list = byDay.get(index)
    if (list) list.push(row)
    else byDay.set(index, [row])
  }

  let balance = input.balance
  const days: ForecastDay[] = []
  for (let i = 0; i <= OUTLOOK_DAYS; i++) {
    const date = addDaysISO(today, i)
    const landing = byDay.get(i) ?? []
    const delta = landing.reduce(
      (sum, r) =>
        sum + (r.direction === 'in' ? 1 : -1) * remainderInBase(r, base, rates),
      0,
    )
    balance += delta
    days.push({
      date,
      balance,
      balanceStr: moneyStr(balance, base),
      dateStr: dayLabel(i, date),
      deltaStr:
        landing.length === 0
          ? ''
          : `${delta < 0 ? '−' : '+'}${formatMoneyRounded(Math.abs(delta), base)}`,
      namesStr: namesOf(landing),
    })
  }

  const lowIndex = days.reduce(
    (low, d, i) => (d.balance < days[low].balance ? i : low),
    0,
  )
  const balances = days.map((d) => d.balance)
  const marks = [
    ...balances,
    ...(input.reserved > 0 ? [input.reserved] : []),
    ...(balances.some((b) => b < 0) ? [0] : []),
  ]
  const low = days[lowIndex]
  const last = days[days.length - 1]

  return {
    days,
    lowIndex,
    reserved: input.reserved,
    status: statusOf(days, input.reserved),
    ...rangeOf(marks),
    isFlat: byDay.size === 0,
    ariaLabel:
      `Balance over the next ${OUTLOOK_DAYS} days: ` +
      `lowest ${low.balanceStr} ${whenOf(lowIndex, low.date)}, ` +
      `${last.balanceStr} on ${shortDate(last.date)}.`,
  }
}
