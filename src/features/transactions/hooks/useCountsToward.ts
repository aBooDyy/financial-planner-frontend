import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalGoal } from '#/db/types'
import { remainderOf, shortDate, usePlannedData } from '#/features/planned'
import type { PlannedRole } from '#/features/planned'
import {
  UNTOUCHED,
  resolveCountsLink,
} from '#/features/transactions/data/countsLink'
import type { CountsChoice } from '#/features/transactions/data/countsLink'
import {
  rankIncomeOptions,
  rankSpendOptions,
} from '#/features/transactions/data/countsToward'
import type { RankedOptions } from '#/features/transactions/data/countsToward'
import { formatMoney, formatMoneyRounded } from '#/lib/currency'
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
export function useCountsToward(
  args: {
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
  },
  /** Held by the caller when the choice must outlive this component (the review queue). */
  control?: { choice: CountsChoice; onChoice: (next: CountsChoice) => void },
) {
  const data = usePlannedData()
  const streams = useLiveQuery(() => db.incomeStreams.toArray())
  const { planned, rates } = data.inputs
  const { index } = data.state
  const isIncome = args.type === 'income'
  const [ownChoice, setOwnChoice] = useState<CountsChoice>(UNTOUCHED)
  const choice = control?.choice ?? ownChoice
  const setChoice = control?.onChoice ?? setOwnChoice

  const { type, isNew, goalId, billId: argBillId, plannedId, amount } = args
  const { currency, date } = args
  const resolved = useMemo(
    () =>
      resolveCountsLink(
        {
          type,
          isNew,
          goalId,
          billId: argBillId,
          plannedId,
          amount,
          currency,
          date,
        },
        choice,
        { planned, remainderOf: (p) => remainderOf(p, index, rates), rates },
      ),
    [
      type,
      isNew,
      goalId,
      argBillId,
      plannedId,
      amount,
      currency,
      date,
      choice,
      planned,
      index,
      rates,
    ],
  )
  const { item, auto, linked, selectedId, streamId } = resolved

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
        : item && auto && linked
          ? {
              name: item.name,
              sub: `Upcoming · ${formatMoneyRounded(item.amount, item.currency)} due ${shortDate(item.date)}`,
              color: 'var(--fp-accent)',
            }
          : nothing

  const banner: LinkBanner | null = item
    ? {
        auto,
        text: auto
          ? `Matches upcoming ${item.name} (${shortDate(item.date)})`
          : `Settles the upcoming ${shortDate(item.date)} ${WHAT[item.role]} (${item.name}).`,
        sub: linked
          ? `Expected ${formatMoney(item.amount, item.currency)} · ${
              isIncome ? 'marks the payday as received' : 'marks it as paid'
            }`
          : `Saves as regular ${isIncome ? 'income' : 'spending'}. ${item.name} is still upcoming.`,
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
    setLinked: (on: boolean) =>
      setChoice({ ...choice, unlinkedId: on || !item ? null : item.id }),
    /** Records a pick from the list; the caller files a spend's pick as its bill or goal. */
    pick: (id: string | null) =>
      setChoice({ pick: { type: args.type, id }, unlinkedId: null }),
    link: resolved.link,
  }
}
