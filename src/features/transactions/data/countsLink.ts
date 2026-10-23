import type { LocalPlanned } from '#/db/types'
import { findMatch } from '#/features/planned/data/settle'
import type { RatesMap } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'
import { parseAmountToMinor } from '#/lib/currency'
import {
  DIALOG_MATCH,
  billIdForMatch,
  findAmountMatch,
  goalIdForMatch,
} from './quickAddMatch'

type EntryType = 'spend' | 'income' | 'transfer'

/** What the user did in "Counts toward": a pick (held for the type it was made under) and a link switched off. */
export type CountsChoice = {
  pick: { type: EntryType; id: string | null } | null
  unlinkedId: string | null
}

export const UNTOUCHED: CountsChoice = { pick: null, unlinkedId: null }

export type CountsEntry = {
  type: EntryType
  isNew: boolean
  goalId: string | null
  billId: string | null
  /** The link the entry already has (editing a settled row), or null. */
  plannedId: string | null
  amount: string
  currency: CurrencyCode
  date: string
}

export type CountsWorld = {
  planned: ReadonlyArray<LocalPlanned>
  remainderOf: (p: LocalPlanned) => number
  rates: RatesMap
}

/** What the entry saves: the planned item it settles and, for a spend, its goal or bill. */
export type CountsLink = {
  plannedId: string | null
  goalId: string | null
  billId: string | null
}

export type CountsResolution = {
  /** The income stream picked, or the linked payday's. */
  streamId: string | null
  /** The planned item the entry settles, found or picked; null when none. */
  item: LocalPlanned | null
  /** `item` was found from the amount and date rather than from a pick. */
  auto: boolean
  linked: boolean
  /** The option "Counts toward" shows as chosen. */
  selectedId: string | null
  link: CountsLink
}

/**
 * Untouched, a new entry links itself to the open planned bill or payday its amount and date
 * match. Otherwise a spend's bill or goal (or an income's stream) settles that origin's
 * matching planned item. A bill picked with no payment near the date keeps its `billId`, so
 * saving pays its first open occurrence. Any found item can be switched off.
 */
export function resolveCountsLink(
  entry: CountsEntry,
  choice: CountsChoice,
  world: CountsWorld,
): CountsResolution {
  const isIncome = entry.type === 'income'
  const isTransfer = entry.type === 'transfer'
  const linkedRow = entry.plannedId
    ? (world.planned.find((p) => p.id === entry.plannedId) ?? null)
    : null
  const picked = choice.pick?.type === entry.type ? choice.pick : null
  const streamId = picked ? picked.id : (linkedRow?.incomeStreamId ?? null)

  const canAuto =
    entry.isNew &&
    !isTransfer &&
    picked === null &&
    entry.plannedId === null &&
    (isIncome || (entry.goalId === null && entry.billId === null))
  const autoItem = canAuto
    ? findAmountMatch({
        type: isIncome ? 'income' : 'spend',
        amount: parseAmountToMinor(entry.amount, entry.currency),
        currency: entry.currency,
        date: entry.date,
        planned: world.planned,
        remainderOf: world.remainderOf,
        rates: world.rates,
        withinDays: DIALOG_MATCH.days,
        tolerance: DIALOG_MATCH.tolerance,
      })
    : null

  const ref =
    entry.plannedId || isTransfer || autoItem
      ? null
      : isIncome
        ? streamId
          ? { incomeStreamId: streamId }
          : null
        : entry.billId
          ? { billId: entry.billId }
          : entry.goalId
            ? { goalId: entry.goalId }
            : null
  const match = ref
    ? findMatch(ref, isIncome ? 'income' : 'payment', entry.date, world.planned)
    : null

  const item = linkedRow ?? autoItem ?? match ?? null
  const auto = item !== null && item === autoItem
  const linked = item !== null && choice.unlinkedId !== item.id
  const autoGoalId = auto && linked ? goalIdForMatch(item, 'spend') : null
  const autoBillId = auto && linked ? billIdForMatch(item, 'spend') : null
  // Switching a found payment off saves regular spending; with none found, a picked bill
  // still pays its first open occurrence.
  const billId = isIncome
    ? null
    : item
      ? linked
        ? billIdForMatch(item, 'spend')
        : null
      : entry.billId
  const selectedId = isIncome
    ? auto && linked
      ? item.incomeStreamId
      : streamId
    : (autoBillId ?? autoGoalId ?? entry.billId ?? entry.goalId)

  return {
    streamId,
    item,
    auto,
    linked,
    selectedId,
    link: {
      plannedId: linked ? item.id : null,
      goalId: isIncome || billId ? null : (autoGoalId ?? entry.goalId),
      billId,
    },
  }
}
