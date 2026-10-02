import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalGoal, LocalPlanned } from '#/db/types'
import {
  remainderOf,
  shortDate,
  usePlannedData,
  usePlannedMatch,
} from '#/features/planned'
import type { PlannedRole } from '#/features/planned'
import {
  rankIncomeOptions,
  rankSpendOptions,
} from '#/features/transactions/data/countsToward'
import type { RankedOptions } from '#/features/transactions/data/countsToward'
import {
  DIALOG_MATCH,
  billIdForMatch,
  findAmountMatch,
  goalIdForMatch,
} from '#/features/transactions/data/quickAddMatch'
import {
  formatMoney,
  formatMoneyRounded,
  parseAmountToMinor,
} from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { EditorTxType } from './useTxEditor'

const WHAT: Record<PlannedRole, string> = {
  set_aside: 'set-aside',
  payment: 'payment',
  income: 'payday',
}

/** What the "Counts toward" row shows; `color` null is "Nothing". */
export type CountsFace = { name: string; sub: string; color: string | null }

/** The planned item the entry settles, as the dialog's link banner reads it. */
export type LinkBanner = {
  /** Found from the amount and date rather than from a pick. */
  auto: boolean
  text: string
  sub: string
  linked: boolean
}

/** A saving goal picked on a spend, or a stream with no payday near the date. */
export type InfoHint = 'saving-goal' | 'no-payday' | null

export type CountsToward = ReturnType<typeof useCountsToward>

/**
 * The transaction dialog's "Counts toward" (1e). Untouched, a new entry links itself to the
 * open planned bill or payday its amount and date match. Otherwise a spend picks a bill (the
 * draft's `billId`: a payment for it) or a goal (`goalId`: money used from it), and an income
 * entry an income stream — only a way to find its payday — and the entry settles that origin's
 * matching planned item. A bill picked with no payment near the date settles its first open
 * occurrence when saved. Every link can be switched off, per item.
 *
 * A spend only ever settles a planned *payment*: a set-aside labels money in place, so money
 * put aside for a goal goes through the goal's "Add contribution", not a spend.
 */
export function useCountsToward(args: {
  type: EditorTxType
  isNew: boolean
  goalId: string | null
  billId: string | null
  /** The link the entry already has (editing a settled row), or null. */
  plannedId: string | null
  amount: string
  currency: CurrencyCode
  date: string
  goals: ReadonlyArray<LocalGoal>
}) {
  const data = usePlannedData()
  const streams = useLiveQuery(() => db.incomeStreams.toArray())
  const { planned, rates } = data.inputs
  const { index } = data.state
  const isIncome = args.type === 'income'
  const isTransfer = args.type === 'transfer'
  const linkedRow = args.plannedId
    ? (planned.find((p) => p.id === args.plannedId) ?? null)
    : null

  // A pick holds for the type it was made under; switching type starts untouched again.
  const [pick, setPick] = useState<{
    type: EditorTxType
    id: string | null
  } | null>(null)
  const picked = pick?.type === args.type ? pick : null
  const streamId = picked ? picked.id : (linkedRow?.incomeStreamId ?? null)

  const canAuto =
    args.isNew &&
    !isTransfer &&
    picked === null &&
    args.plannedId === null &&
    (isIncome || (args.goalId === null && args.billId === null))
  const minor = parseAmountToMinor(args.amount, args.currency)
  const autoItem = useMemo(
    () =>
      canAuto
        ? findAmountMatch({
            type: isIncome ? 'income' : 'spend',
            amount: minor,
            currency: args.currency,
            date: args.date,
            planned,
            remainderOf: (p) => remainderOf(p, index, rates),
            rates,
            withinDays: DIALOG_MATCH.days,
            tolerance: DIALOG_MATCH.tolerance,
          })
        : null,
    [canAuto, isIncome, minor, args.currency, args.date, planned, index, rates],
  )

  const ref =
    args.plannedId || isTransfer || autoItem
      ? null
      : isIncome
        ? streamId
          ? { incomeStreamId: streamId }
          : null
        : args.billId
          ? { billId: args.billId }
          : args.goalId
            ? { goalId: args.goalId }
            : null
  const match = usePlannedMatch(ref, isIncome ? 'income' : 'payment', args.date)

  const item: LocalPlanned | null = linkedRow ?? autoItem ?? match?.item ?? null
  const auto = item !== null && item === autoItem
  const [unlinkedId, setUnlinkedId] = useState<string | null>(null)
  const linked = item !== null && unlinkedId !== item.id
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
      : args.billId
  const selectedId = isIncome
    ? auto && linked
      ? item.incomeStreamId
      : streamId
    : (autoBillId ?? autoGoalId ?? args.billId ?? args.goalId)

  const options: RankedOptions = useMemo(
    () =>
      isIncome
        ? rankIncomeOptions({
            streams: streams ?? [],
            planned,
            date: args.date,
            selectedId,
          })
        : rankSpendOptions({
            goals: args.goals,
            bills: data.inputs.bills,
            planned,
            date: args.date,
            savedOf: (g) => data.state.progress[g.id]?.progress ?? 0,
            selectedId,
          }),
    [
      isIncome,
      streams,
      planned,
      args.date,
      args.goals,
      data.inputs.bills,
      data.state,
      selectedId,
    ],
  )

  const nothing: CountsFace = {
    name: 'Nothing',
    sub: isIncome ? 'Regular income' : 'Regular spending',
    color: null,
  }
  const chosen = [...options.top, ...options.rest].find(
    (o) => o.id === selectedId,
  )
  const face: CountsFace | null =
    isIncome && auto
      ? null
      : chosen
        ? chosen
        : auto && linked
          ? {
              name: item.name,
              sub: `Planned · ${formatMoneyRounded(item.amount, item.currency)} due ${shortDate(item.date)}`,
              color: 'var(--fp-accent)',
            }
          : nothing

  const banner: LinkBanner | null = item
    ? {
        auto,
        text: auto
          ? `Matches planned ${item.name} (${shortDate(item.date)})`
          : `Settles the planned ${shortDate(item.date)} ${WHAT[item.role]} (${item.name}).`,
        sub: linked
          ? `Expected ${formatMoney(item.amount, item.currency)} · ${
              isIncome ? 'marks the payday as received' : 'marks it as paid'
            }`
          : `Saves as regular ${isIncome ? 'income' : 'spending'}. ${item.name} stays planned.`,
        linked,
      }
    : null

  const goal = args.goalId
    ? (args.goals.find((g) => g.id === args.goalId) ?? null)
    : null
  const infoHint: InfoHint =
    !isIncome && goal && !item
      ? 'saving-goal'
      : isIncome && streamId && !item
        ? 'no-payday'
        : null

  return {
    isIncome,
    options,
    selectedId,
    face,
    banner,
    infoHint,
    setLinked: (on: boolean) => setUnlinkedId(on || !item ? null : item.id),
    /** Records a pick from the list; the caller files a spend's pick as its bill or goal. */
    pick: (id: string | null) => {
      setPick({ type: args.type, id })
      setUnlinkedId(null)
    },
    /** What the entry saves: the planned item it settles and, for a spend, its goal or bill. */
    link: {
      plannedId: linked ? item.id : null,
      goalId: isIncome || billId ? null : (autoGoalId ?? args.goalId),
      billId,
    },
  }
}
