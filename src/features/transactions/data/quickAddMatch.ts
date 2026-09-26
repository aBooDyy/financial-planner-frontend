/**
 * Settling a planned item by its amount (1e). QuickAdd has no "Counts toward" picker, so it
 * links only an unmistakable match; the transaction dialog offers a looser one, which the user
 * sees and can switch off.
 */
import type { LocalBalanceNode, LocalPlanned, LocalRecurring } from '#/db/types'
import type { TxType } from '#/features/transactions/api/types'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { daysApart } from './countsToward'

export const QUICK_MATCH_DAYS = 3

/** The transaction dialog shows its match and lets the user switch it off, so it can be looser. */
export const DIALOG_MATCH = { days: 7, tolerance: 0.1 } as const

/**
 * Paydays and Spending schedules, plus obligation payments. A set-aside is never settled by a
 * transaction, and a hand-made item is too loosely defined to guess at.
 */
const settlesBy = (item: LocalPlanned, type: TxType): boolean =>
  type === 'income'
    ? item.role === 'income'
    : item.role === 'payment' &&
      (item.origin === 'recurring' || item.origin === 'goal')

const oldestFirst = (a: LocalPlanned, b: LocalPlanned): number =>
  a.date.localeCompare(b.date) ||
  a.occurrence.localeCompare(b.occurrence) ||
  a.name.localeCompare(b.name)

type MatchArgs = {
  type: TxType
  amount: number | null
  currency: CurrencyCode
  /** The day the entry is dated. */
  date: string
  planned: ReadonlyArray<LocalPlanned>
  remainderOf: (item: LocalPlanned) => number
  rates: RatesMap
}

/**
 * The open planned item an entry of `amount` (in `currency`) would settle, or null: dated
 * within `withinDays` of `date`, with what is still open on it — in its own currency — no
 * further than `tolerance` (a fraction) from the converted amount. Several matches settle the
 * oldest first.
 */
export function findAmountMatch(
  args: MatchArgs & { withinDays: number; tolerance: number },
): LocalPlanned | null {
  const { amount } = args
  if (amount === null || amount <= 0) return null
  const candidates = args.planned.filter((p) => {
    if (p.deleted !== 0 || p.status !== 'open') return false
    if (!settlesBy(p, args.type)) return false
    if (daysApart(p.date, args.date) > args.withinDays) return false
    const remainder = args.remainderOf(p)
    if (remainder <= 0) return false
    const converted = convertMinor(
      amount,
      args.currency,
      p.currency,
      args.rates,
    )
    return Math.abs(converted - remainder) <= remainder * args.tolerance
  })
  return [...candidates].sort(oldestFirst)[0] ?? null
}

/** QuickAdd's rule: the exact open amount, within a few days of today. */
export const findQuickAddMatch = ({
  today,
  ...args
}: Omit<MatchArgs, 'date'> & { today: string }): LocalPlanned | null =>
  findAmountMatch({
    ...args,
    date: today,
    withinDays: QUICK_MATCH_DAYS,
    tolerance: 0,
  })

/** A payment toward a goal carries the goal, whichever origin planned it. */
export function goalIdForMatch(
  item: LocalPlanned,
  type: TxType,
  recurrings: ReadonlyArray<LocalRecurring>,
): string | null {
  if (type !== 'spend') return null
  if (item.goalId) return item.goalId
  if (item.origin !== 'recurring' || !item.recurringId) return null
  return recurrings.find((r) => r.id === item.recurringId)?.goalId ?? null
}

/** The live wallet the item planned to use, or null (none planned, or since deleted). */
export function plannedWalletOf(
  item: LocalPlanned,
  nodes: ReadonlyArray<LocalBalanceNode>,
): LocalBalanceNode | null {
  if (!item.walletId) return null
  return (
    nodes.find(
      (n) =>
        n.id === item.walletId &&
        n.kind === 'wallet' &&
        n.currency !== null &&
        n.deleted === 0,
    ) ?? null
  )
}

/**
 * Where a QuickAdd entry is written. A linked entry goes to the wallet its planned item names —
 * that is what the user planned, even over the account QuickAdd is scoped to — with the typed
 * amount converted into that wallet's currency. Otherwise QuickAdd's own account.
 */
export function quickAddTarget(args: {
  amount: number
  currency: CurrencyCode
  walletId: string | null
  plannedWallet: { id: string; currency: CurrencyCode } | null
  rates: RatesMap
}): { walletId: string; amount: number; currency: CurrencyCode } | null {
  const w = args.plannedWallet
  if (w) {
    return {
      walletId: w.id,
      currency: w.currency,
      amount: convertMinor(args.amount, args.currency, w.currency, args.rates),
    }
  }
  return args.walletId
    ? { walletId: args.walletId, amount: args.amount, currency: args.currency }
    : null
}
