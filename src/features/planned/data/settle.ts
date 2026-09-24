/**
 * Pure derivations over planned rows and what settles them. Nothing here is stored: a row's
 * settled amount is always the sum of the transactions and reservations that point at it.
 */
import type {
  LocalGoalAllocation,
  LocalPlanned,
  LocalTransaction,
} from '#/db/types'
import type { PlannedRole } from '#/features/planned/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { addDaysISO, isoOf } from './dates'

/** A real row that settles (part of) a planned item. */
export type Settlement = {
  kind: 'transaction' | 'allocation'
  id: string
  plannedId: string | null
  goalId: string | null
  amount: number
  currency: CurrencyCode
  date: string
  walletId: string | null
  externalLabel: string | null
}

/** Settlements keyed by the planned id they point at (or a legacy recurring marker). */
export type SettlementIndex = ReadonlyMap<string, ReadonlyArray<Settlement>>

const LEGACY_PREFIX = 'legacy:'

/**
 * Before recurrings moved onto planned rows, an auto-posted occurrence was marked only by its
 * `source`. Such a transaction settles the occurrence it names, so nothing posts twice.
 */
export const legacyMarkerOf = (recurringId: string, occurrence: string) =>
  `recurring:${recurringId}:${occurrence}`

const legacyKeyOf = (item: LocalPlanned): string | null =>
  item.origin === 'recurring' && item.recurringId
    ? `${LEGACY_PREFIX}${legacyMarkerOf(item.recurringId, item.occurrence)}`
    : null

export const txSettlement = (t: LocalTransaction): Settlement => ({
  kind: 'transaction',
  id: t.id,
  plannedId: t.plannedId,
  goalId: t.goalId,
  amount: t.amount,
  currency: t.currency,
  date: t.date,
  walletId: t.walletId,
  externalLabel: null,
})

export const allocationSettlement = (a: LocalGoalAllocation): Settlement => ({
  kind: 'allocation',
  id: a.id,
  plannedId: a.plannedId,
  goalId: a.goalId,
  amount: a.amount,
  currency: a.currency,
  date: a.date,
  walletId: a.source === 'wallet' ? a.walletId : null,
  externalLabel: a.source === 'external' ? a.externalLabel : null,
})

export function indexSettlements(
  txns: ReadonlyArray<LocalTransaction>,
  allocations: ReadonlyArray<LocalGoalAllocation>,
): SettlementIndex {
  const out = new Map<string, Settlement[]>()
  const add = (key: string, s: Settlement) => {
    const list = out.get(key)
    if (list) list.push(s)
    else out.set(key, [s])
  }
  for (const t of txns) {
    if (t.deleted !== 0) continue
    if (t.plannedId) add(t.plannedId, txSettlement(t))
    else if (t.source?.startsWith('recurring:'))
      add(`${LEGACY_PREFIX}${t.source}`, txSettlement(t))
  }
  for (const a of allocations) {
    if (a.deleted === 0 && a.plannedId)
      add(a.plannedId, allocationSettlement(a))
  }
  return out
}

export function settlementsFor(
  item: LocalPlanned,
  index: SettlementIndex,
): Settlement[] {
  const legacy = legacyKeyOf(item)
  return [
    ...(index.get(item.id) ?? []),
    ...(legacy ? (index.get(legacy) ?? []) : []),
  ]
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
  | { recurringId: string }

/** How far before / after the entry's date a planned item still counts as the same one. */
export const MATCH_WINDOW = { before: 45, after: 15 } as const

const refersTo = (item: LocalPlanned, ref: MatchRef): boolean => {
  if ('goalId' in ref) return item.goalId === ref.goalId
  if ('incomeStreamId' in ref) return item.incomeStreamId === ref.incomeStreamId
  return item.recurringId === ref.recurringId
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
