/**
 * Pure derivations over planned rows and what settles them. Nothing here is stored: a row's
 * settled amount is always the sum of the transactions and set-asides that point at it.
 */
import type { LocalPlanned, LocalSetAside, LocalTransaction } from '#/db/types'
import type { PlannedRole } from '#/features/planned/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { addDaysISO, isoOf } from './dates'

/** A real row that settles (part of) a planned item. */
export type Settlement = {
  kind: 'transaction' | 'setAside'
  id: string
  plannedId: string | null
  goalId: string | null
  billId: string | null
  amount: number
  currency: CurrencyCode
  date: string
  walletId: string | null
  externalLabel: string | null
}

/** Settlements keyed by the planned id they point at. */
export type SettlementIndex = ReadonlyMap<string, ReadonlyArray<Settlement>>

export const txSettlement = (t: LocalTransaction): Settlement => ({
  kind: 'transaction',
  id: t.id,
  plannedId: t.plannedId,
  goalId: t.goalId,
  billId: t.billId ?? null,
  amount: t.amount,
  currency: t.currency,
  date: t.date,
  walletId: t.walletId,
  externalLabel: null,
})

/**
 * A set-aside settles its planned row while it is live, and still does once a payment released
 * it (the money was set aside, then used). One freed, moved or released by a close does not:
 * the money is no longer set aside for that row (a move's new row carries the link instead).
 */
export const settlesItsRow = (
  a: Pick<LocalSetAside, 'releasedAt' | 'releasedById'>,
): boolean => a.releasedAt === null || a.releasedById !== null

export const setAsideSettlement = (a: LocalSetAside): Settlement => ({
  kind: 'setAside',
  id: a.id,
  plannedId: a.plannedId,
  goalId: a.goalId,
  billId: a.billId,
  amount: a.amount,
  currency: a.currency,
  date: a.date,
  walletId: a.source === 'wallet' ? a.walletId : null,
  externalLabel: a.source === 'outside' ? a.externalLabel : null,
})

export function indexSettlements(
  txns: ReadonlyArray<LocalTransaction>,
  setAsides: ReadonlyArray<LocalSetAside>,
): SettlementIndex {
  const out = new Map<string, Settlement[]>()
  const add = (key: string, s: Settlement) => {
    const list = out.get(key)
    if (list) list.push(s)
    else out.set(key, [s])
  }
  for (const t of txns) {
    if (t.deleted === 0 && t.plannedId) add(t.plannedId, txSettlement(t))
  }
  for (const a of setAsides) {
    if (a.deleted === 0 && a.plannedId && settlesItsRow(a))
      add(a.plannedId, setAsideSettlement(a))
  }
  return out
}

export function settlementsFor(
  item: LocalPlanned,
  index: SettlementIndex,
): Settlement[] {
  return [...(index.get(item.id) ?? [])]
}

/** Σ what settles the item, in the item's currency. */
export function settledOf(
  item: LocalPlanned,
  index: SettlementIndex,
  rates: RatesMap,
): number {
  return settlementsFor(item, index).reduce(
    (sum, s) => sum + convertMinor(s.amount, s.currency, item.currency, rates),
    0,
  )
}

export const hasSettlements = (
  item: LocalPlanned,
  index: SettlementIndex,
): boolean => settlementsFor(item, index).length > 0

export function remainderOf(
  item: LocalPlanned,
  index: SettlementIndex,
  rates: RatesMap,
): number {
  return Math.max(0, item.amount - settledOf(item, index, rates))
}

const todayISO = (today: Date | string): string =>
  typeof today === 'string' ? today : isoOf(today)

/** Needs confirming: still open and its date has arrived. */
export const isDue = (item: LocalPlanned, today: Date | string): boolean =>
  item.status === 'open' && item.date <= todayISO(today)

const byDate = (a: LocalPlanned, b: LocalPlanned): number =>
  a.date.localeCompare(b.date) ||
  a.occurrence.localeCompare(b.occurrence) ||
  a.name.localeCompare(b.name)

/** Every item that needs confirming, oldest first — the backlog clears from the bottom. */
export function dueList(
  items: ReadonlyArray<LocalPlanned>,
  today: Date | string,
): LocalPlanned[] {
  return items.filter((p) => p.deleted === 0 && isDue(p, today)).sort(byDate)
}

export type Behind = {
  /** Σ planned for this goal up to today — skipped rows included. */
  expected: number
  /** Σ settled against those rows. */
  settled: number
  /** `expected − settled`; negative means ahead of plan. */
  behind: number
  /** Rows the user skipped: behind on purpose. */
  skipped: LocalPlanned[]
  /** Rows still waiting for a confirm, oldest first. */
  unconfirmed: LocalPlanned[]
}

/** How far a goal's stored plan is behind what has actually been confirmed. */
export function behindOf(
  goalId: string,
  items: ReadonlyArray<LocalPlanned>,
  index: SettlementIndex,
  rates: RatesMap,
  today: Date | string,
): Behind {
  const now = todayISO(today)
  const past = items
    .filter(
      (p) =>
        p.deleted === 0 &&
        p.origin === 'goal' &&
        p.goalId === goalId &&
        p.date <= now,
    )
    .sort(byDate)
  const expected = past.reduce((sum, p) => sum + p.amount, 0)
  const settled = past.reduce((sum, p) => sum + settledOf(p, index, rates), 0)
  return {
    expected,
    settled,
    behind: expected - settled,
    skipped: past.filter((p) => p.status === 'skipped'),
    unconfirmed: past.filter(
      (p) => p.status === 'open' && settledOf(p, index, rates) < p.amount,
    ),
  }
}

/** What a transaction or contribution is being saved toward. */
export type MatchRef =
  | { goalId: string }
  | { incomeStreamId: string }
  | { billId: string }

/** How far before / after the entry's date a planned item still counts as the same one. */
export const MATCH_WINDOW = { before: 45, after: 15 } as const

const refersTo = (item: LocalPlanned, ref: MatchRef): boolean => {
  if ('goalId' in ref) return item.goalId === ref.goalId
  if ('incomeStreamId' in ref) return item.incomeStreamId === ref.incomeStreamId
  return item.billId === ref.billId
}

/**
 * The planned item a new entry settles instead of duplicating: that origin's oldest open
 * item of a matching role dated within the window around the entry. Amount plays no part —
 * a smaller payment is a partial, a larger one an overpayment.
 */
export function findMatch(
  ref: MatchRef,
  roles: PlannedRole | ReadonlyArray<PlannedRole>,
  date: string,
  items: ReadonlyArray<LocalPlanned>,
): LocalPlanned | null {
  const wanted = typeof roles === 'string' ? [roles] : roles
  const from = addDaysISO(date, -MATCH_WINDOW.before)
  const to = addDaysISO(date, MATCH_WINDOW.after)
  const candidates = items
    .filter(
      (p) =>
        p.deleted === 0 &&
        p.status === 'open' &&
        wanted.includes(p.role) &&
        refersTo(p, ref) &&
        p.date >= from &&
        p.date <= to,
    )
    .sort(byDate)
  return candidates[0] ?? null
}
