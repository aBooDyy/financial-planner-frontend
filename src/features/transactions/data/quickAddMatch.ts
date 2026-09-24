/**
 * QuickAdd's match hint (1e): QuickAdd has no "Counts toward" picker, so an entry settles a
 * planned item only when it is unmistakably that item — same type, the exact open amount, and
 * dated within a few days of today.
 */
import type { LocalBalanceNode, LocalPlanned, LocalRecurring } from '#/db/types'
import type { TxType } from '#/features/transactions/api/types'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { daysApart } from './countsToward'

export const QUICK_MATCH_DAYS = 3

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

/**
 * The open planned item a QuickAdd entry would settle, or null. `amount` is in `currency`
 * (the entry's) and must equal what is still open on the item once converted to the item's
 * currency. Several matches settle the oldest first.
 */
export function findQuickAddMatch(args: {
  type: TxType
  amount: number | null
  currency: CurrencyCode
  today: string
  planned: ReadonlyArray<LocalPlanned>
  remainderOf: (item: LocalPlanned) => number
  rates: RatesMap
}): LocalPlanned | null {
  const { amount } = args
  if (amount === null || amount <= 0) return null
  const candidates = args.planned.filter((p) => {
    if (p.deleted !== 0 || p.status !== 'open') return false
    if (!settlesBy(p, args.type)) return false
    if (daysApart(p.date, args.today) > QUICK_MATCH_DAYS) return false
    const remainder = args.remainderOf(p)
    return (
      remainder > 0 &&
      convertMinor(amount, args.currency, p.currency, args.rates) === remainder
    )
  })
  return [...candidates].sort(oldestFirst)[0] ?? null
}

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
