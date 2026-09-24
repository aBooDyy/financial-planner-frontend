import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalGoal } from '#/db/types'
import { shortDate, usePlannedData, usePlannedMatch } from '#/features/planned'
import type { PlannedRole } from '#/features/planned'
import {
  isSavingGoal,
  rankGoalOptions,
  rankIncomeOptions,
} from '#/features/transactions/data/countsToward'
import type { RankedOptions } from '#/features/transactions/data/countsToward'
import type { EditorTxType } from './useTxEditor'

const WHAT: Record<PlannedRole, string> = {
  set_aside: 'set-aside',
  payment: 'payment',
  income: 'payday',
}

export type CountsToward = ReturnType<typeof useCountsToward>

/**
 * The TxEditor's "Counts toward" field (1e). A spend picks a goal or obligation (the draft's
 * `goalId`); an income entry picks an income stream, which is only a way to find its planned
 * payday. Either way the entry settles the matching open planned item — unless "Don't link" —
 * and `plannedId` is what to save.
 *
 * A spend only ever settles a planned *payment*: a goal's set-aside is a reservation, so money
 * put aside for a saving goal goes through the goal's "Add contribution", not a spend.
 */
export function useCountsToward(args: {
  type: EditorTxType
  goalId: string | null
  /** The link the entry already has (editing a settled row), or null. */
  plannedId: string | null
  date: string
  goals: ReadonlyArray<LocalGoal>
}) {
  const data = usePlannedData()
  const streams = useLiveQuery(() => db.incomeStreams.toArray())
  const planned = data.inputs.planned
  const linked = args.plannedId
    ? (planned.find((p) => p.id === args.plannedId) ?? null)
    : null

  // Until the user picks, an income entry shows the stream of the payday it already settles.
  const [picked, setPicked] = useState<{ id: string | null } | null>(null)
  const streamId = picked ? picked.id : (linked?.incomeStreamId ?? null)
  const [optOut, setOptOut] = useState(false)
  const isIncome = args.type === 'income'
  const selectedId = isIncome ? streamId : args.goalId
  const goal = args.goalId
    ? (args.goals.find((g) => g.id === args.goalId) ?? null)
    : null

  const ref =
    args.plannedId || args.type === 'transfer'
      ? null
      : isIncome
        ? streamId
          ? { incomeStreamId: streamId }
          : null
        : args.goalId
          ? { goalId: args.goalId }
          : null
  const match = usePlannedMatch(ref, isIncome ? 'income' : 'payment', args.date)

  const options: RankedOptions = useMemo(
    () =>
      isIncome
        ? rankIncomeOptions({
            streams: streams ?? [],
            planned,
            date: args.date,
            selectedId,
          })
        : rankGoalOptions({
            goals: args.goals,
            planned,
            date: args.date,
            savedOf: (g) =>
              g.saved + (data.state.progress[g.id]?.progress ?? 0),
            selectedId,
          }),
    [isIncome, streams, planned, args.date, args.goals, data.state, selectedId],
  )

  const linkHint = linked
    ? `Settles the planned ${shortDate(linked.date)} ${WHAT[linked.role]} (${linked.name}).`
    : (match?.hint ?? null)
  const savingHint =
    !isIncome && goal && isSavingGoal(goal) && !linkHint
      ? 'Counts as spending this goal’s money. To put money aside, use Add contribution on the goal.'
      : null
  const noPaydayHint =
    isIncome && streamId && !linkHint
      ? 'No planned payday near this date — it saves as regular income.'
      : null

  return {
    isIncome,
    options,
    selectedId,
    linkHint,
    infoHint: savingHint ?? noPaydayHint,
    optOut,
    setOptOut,
    /** For an income entry; a spend's choice is the draft's goal. */
    selectStream: (id: string | null) => {
      setPicked({ id })
      setOptOut(false)
    },
    /** What the entry saves as its planned link. */
    plannedId: optOut ? null : (args.plannedId ?? match?.item.id ?? null),
  }
}
