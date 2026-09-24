import { useMemo, useState } from 'react'
import { remainderOf, shortDate, usePlannedData } from '#/features/planned'
import type { LocalPlanned } from '#/features/planned'
import type { TxType } from '#/features/transactions/api/types'
import {
  findQuickAddMatch,
  goalIdForMatch,
  plannedWalletOf,
} from '#/features/transactions/data/quickAddMatch'
import { parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

export type QuickAddMatch = ReturnType<typeof useQuickAddMatch>

/**
 * The planned item QuickAdd's typed amount would settle, the hint that says so, and whether
 * the user kept the link. Turning the link off holds for that item only — a different match
 * starts linked again.
 */
export function useQuickAddMatch(args: {
  type: TxType
  amount: string
  currency: CurrencyCode
}) {
  const data = usePlannedData()
  const minor = parseAmountToMinor(args.amount, args.currency)
  const { index } = data.state
  const { planned, rates, recurrings } = data.inputs

  const item: LocalPlanned | null = useMemo(
    () =>
      findQuickAddMatch({
        type: args.type,
        amount: minor,
        currency: args.currency,
        today: data.today,
        planned,
        remainderOf: (p) => remainderOf(p, index, rates),
        rates,
      }),
    [args.type, minor, args.currency, data.today, planned, index, rates],
  )
  const wallet = item ? plannedWalletOf(item, data.nodes) : null
  const [unlinkedId, setUnlinkedId] = useState<string | null>(null)
  const linked = item !== null && unlinkedId !== item.id

  return {
    /** "Matches planned Salary (Sep 27) → Main Checking", or null when nothing matches. */
    hint: item
      ? `Matches planned ${item.name} (${shortDate(item.date)})${
          wallet ? ` → ${wallet.name}` : ''
        }`
      : null,
    linked,
    setLinked: (on: boolean) => setUnlinkedId(on || !item ? null : item.id),
    /** What the entry saves with: the item it settles, the goal a payment carries, and the
     *  wallet the item planned (null: QuickAdd's own account). */
    rates,
    link:
      item && linked
        ? {
            plannedId: item.id,
            goalId: goalIdForMatch(item, args.type, recurrings),
            name: item.name,
            wallet: wallet?.currency
              ? { id: wallet.id, currency: wallet.currency }
              : null,
          }
        : null,
  }
}
