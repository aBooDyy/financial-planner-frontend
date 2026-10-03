/**
 * Upcoming's copy (04 §5, design §4): each period's head and footer, and each row's meta and
 * state line. Pure.
 */
import type { LocalBill, LocalGoal } from '#/db/types'
import { daysBetween } from '#/features/planned/data/dates'
import type { FundingPlan } from '#/features/planning/data/funding'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import type { BillStatus, GoalStatus } from '#/features/planning/data/status'
import type {
  UpcomingPeriod,
  UpcomingRow,
} from '#/features/planning/data/upcoming'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { dayMonth, money, monthYear, plural } from './format'

/** Within this many days a payment reads "Due in N days" and offers Pay. */
export const SOON_DAYS = 10
/** A covered payment reads "Set aside ✓" when due within this many days. */
const COVERED_SHOWN_DAYS = 40

export type PeriodHead = {
  label: string
  title: string
  range: string
}

export function periodHead(
  p: UpcomingPeriod,
  calendar: PayCalendar,
  today: string,
  base: CurrencyCode,
): PeriodHead {
  const paycheck = calendar.kind === 'paycheck'
  const span = `${dayMonth(p.period.start)} – ${dayMonth(p.period.end)}`
  if (p.kind === 'this') {
    const left = daysBetween(today, p.period.end) + 1
    return {
      label: paycheck ? 'Until payday' : 'This month',
      title: `Now → ${dayMonth(p.period.end)}`,
      range: `${plural(left, 'day')} left`,
    }
  }
  const income = p.incomeIn > 0 ? `+${money(p.incomeIn, base)} in` : ''
  if (p.kind === 'next')
    return {
      label: paycheck
        ? `Next paycheck · ${dayMonth(p.period.start)}`
        : `Next month · ${monthYear(p.period.start)}`,
      title: span,
      range: income,
    }
  return { label: 'Later', title: span, range: income }
}

/** "Bills SR 3,660 · Set aside SR 2,990 · Left SR 4,730 · Car service Jan 15". */
export function periodSummary(p: UpcomingPeriod, base: CurrencyCode): string {
  return [
    `Bills ${money(p.paymentsOut, base)}`,
    `Set aside ${money(p.setAsideOut, base)}`,
    `Left ${money(p.left, base)}`,
    ...p.payments
      .filter((r) => r.savedUp)
      .map((r) => `${r.name} ${dayMonth(r.item.date)}`),
  ].join(' · ')
}

/** What is still to pay before payday that nothing set aside covers. */
export const stillToPay = (
  p: UpcomingPeriod,
  base: CurrencyCode,
  rates: RatesMap,
): number =>
  p.payments.reduce(
    (sum, r) =>
      sum +
      convertMinor(
        Math.max(0, r.remainder - (r.coverage?.setAside ?? 0)),
        r.currency,
        base,
        rates,
      ),
    0,
  )

export type RowState = {
  label: string
  tone: 'ok' | 'warn' | 'danger' | 'muted'
}

/** A payment's line under its amount: Set aside ✓ · Overdue · Due in N days · the date. */
export function paymentState(row: UpcomingRow, today: string): RowState {
  const days = daysBetween(today, row.item.date)
  if (row.coverage?.state === 'covered' && days <= COVERED_SHOWN_DAYS)
    return { label: 'Set aside ✓', tone: 'ok' }
  if (days < 0) return { label: 'Overdue', tone: 'danger' }
  if (days <= SOON_DAYS)
    return {
      label:
        days === 0
          ? 'Due today'
          : days === 1
            ? 'Due tomorrow'
            : `Due in ${days} days`,
      tone: 'warn',
    }
  return { label: dayMonth(row.item.date), tone: 'muted' }
}

/**
 * A set-aside's line under its amount: the paychecks from this one through the last that can
 * still fund what it goes toward, or "ongoing" when that has no date.
 */
export function setAsideState(
  row: UpcomingRow,
  funding: FundingPlan,
): RowState | undefined {
  const { billId, goalId } = row.item
  const slot = funding.slots.findIndex((s) => s.date === row.item.date)
  const track = funding.tracks.find((t) =>
    billId
      ? t.kind === 'bill' &&
        t.ownerId === billId &&
        t.start <= slot &&
        slot <= t.end
      : t.kind === 'goal' && t.ownerId === goalId,
  )
  if (!track) return undefined
  if (track.deadline === null) return { label: 'ongoing', tone: 'muted' }
  if (slot < 0 || slot > track.end) return undefined
  return {
    label: `${plural(track.end - slot + 1, 'paycheck')} left`,
    tone: 'muted',
  }
}

/** "Oct 18 · Main bank · saved SR 3,000". */
export function paymentMeta(row: UpcomingRow): string {
  return [
    dayMonth(row.item.date),
    row.walletName,
    row.savedUp && row.coverage && row.coverage.setAside > 0
      ? `saved ${money(row.coverage.setAside, row.currency)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** A set-aside's meta: what it goes toward. */
export function setAsideMeta(
  row: UpcomingRow,
  owner:
    | { kind: 'bill'; bill: LocalBill; status: BillStatus | undefined }
    | { kind: 'goal'; goal: LocalGoal; status: GoalStatus | undefined }
    | null,
): string {
  if (!owner) return dayMonth(row.item.date)
  if (owner.kind === 'bill') {
    const s = owner.status
    const c = owner.bill.currency
    return s?.occurrence
      ? `Due ${dayMonth(s.occurrence)} · ${money(s.setAside, c)} of ${money(s.amount, c)}`
      : dayMonth(row.item.date)
  }
  const s = owner.status
  const c = owner.goal.currency
  if (!s) return dayMonth(row.item.date)
  if (s.target <= 0) return `${money(s.progress, c)} saved`
  return [
    `${money(s.progress, c)} of ${money(s.target, c)}`,
    owner.goal.dueDate ? `by ${monthYear(owner.goal.dueDate)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** The toast after a row's one-tap confirm: "Rent marked as paid", "SR 940 set aside for Umrah". */
export function confirmedText(row: UpcomingRow, name: string): string {
  if (row.item.role === 'set_aside')
    return `${money(row.remainder, row.currency)} set aside for ${name}`
  if (row.item.role === 'income') return `${name} marked as received`
  return `${name} marked as paid`
}

export const skippedText = (name: string): string => `${name} skipped`
