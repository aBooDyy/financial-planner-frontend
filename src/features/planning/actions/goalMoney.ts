/**
 * Spending a goal's money: "Use it" on a goal, and "I spent it" when marking one done (D20,
 * D30). Either records a spend linked to the goal — filed under the category the user picks,
 * remembered on the goal for next time — and releases the goal's set-asides in the paying
 * wallet, as any payment does. "Use it" on an open goal then has its stored plan rewritten
 * quietly, like Add money: a spend beyond what was held counts as progress too.
 */
import { db } from '#/db/db'
import type { LocalGoal } from '#/db/types'
import { closeGoal } from '#/features/goals/data/actions'
import { updateGoal } from '#/features/goals/data/mutations'
import { isoOf } from '#/features/planned/data/dates'
import { goalOwner } from '#/features/planned/data/owners'
import { walletCurrency } from '#/features/planned/data/mutations'
import { requestPlanRecalc } from '#/features/planned/data/recalcRequests'
import { currentRates } from '#/features/planned/data/rows'
import {
  heldInWallet,
  releaseForPayment,
} from '#/features/setAsides/data/payment'
import { addTransactionWithId } from '#/features/transactions/data/mutations'
import { convertMinor } from '#/lib/currency'
import { newId } from '#/lib/uuid'
import { MoneyActionError } from './errors'

export type GoalSpendInput = {
  /** In the goal's currency. */
  amount: number
  walletId: string
  /** A spend category; defaults to the one remembered on the goal. */
  categoryId?: string
  date?: string
  note?: string | null
}

async function liveGoal(id: string): Promise<LocalGoal> {
  const goal = await db.goals.get(id)
  if (!goal || goal.deleted !== 0) throw new MoneyActionError('not_found')
  return goal
}

/** The spend and the release it makes. Returns the transaction's id. */
async function recordGoalSpend(
  goal: LocalGoal,
  input: GoalSpendInput,
): Promise<string> {
  const goalId = goal.id
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    throw new MoneyActionError('bad_amount')
  const categoryId = input.categoryId ?? goal.useCategoryId
  if (!categoryId) throw new MoneyActionError('category_required')
  const currency = await walletCurrency(input.walletId)
  if (!currency) throw new MoneyActionError('no_wallet')
  if (categoryId !== goal.useCategoryId)
    await updateGoal(goalId, { useCategoryId: categoryId })

  const rates = await currentRates()
  const date = input.date ?? isoOf(new Date())
  const amount = convertMinor(input.amount, goal.currency, currency, rates)
  const id = newId()
  await addTransactionWithId(id, {
    type: 'spend',
    amount,
    currency,
    categoryId,
    walletId: input.walletId,
    goalId,
    billId: null,
    merchantId: null,
    date,
    note: input.note !== undefined ? input.note : goal.name,
    source: null,
    plannedId: null,
  })
  await releaseForPayment(
    { goalId },
    { id, walletId: input.walletId, amount, currency, date },
    rates,
  )
  return id
}

/** "Use it": a spend from the goal. Returns the transaction's id. */
export async function spendFromGoal(
  goalId: string,
  input: GoalSpendInput,
): Promise<string> {
  const goal = await liveGoal(goalId)
  const id = await recordGoalSpend(goal, input)
  if (goal.closedAt === null)
    requestPlanRecalc(goalOwner(goalId), { quiet: true })
  return id
}

/** One wallet's share of "I spent it", in the goal's currency. */
export type GoalSpendPart = { walletId: string; amount: number }

export type MarkGoalSpentInput = Pick<GoalSpendInput, 'categoryId' | 'date'> &
  (
    | { parts: ReadonlyArray<GoalSpendPart> }
    /** One wallet; the amount defaults to what that wallet holds for the goal. */
    | { walletId: string; amount?: number }
  )

/** What `walletId` holds for the goal, in the goal's currency. */
async function heldInWalletFor(
  goal: LocalGoal,
  walletId: string,
): Promise<number> {
  const rates = await currentRates()
  return heldInWallet(
    await db.setAsides.where('goalId').equals(goal.id).toArray(),
    { goalId: goal.id },
    walletId,
  ).reduce(
    (sum, a) => sum + convertMinor(a.amount, a.currency, goal.currency, rates),
    0,
  )
}

/**
 * "I spent it" in Mark as done: one spend per paying wallet — each releasing what that wallet
 * held for the goal, so every wallet's Balance still matches its bank — then the close, which
 * frees whatever is still set aside (other wallets, money held outside). Not atomic: a failure
 * between the spends and the close leaves an open goal with payments, which is harmless and
 * retryable. Returns the spends' ids.
 */
export async function markGoalSpent(
  goalId: string,
  input: MarkGoalSpentInput,
): Promise<string[]> {
  const goal = await liveGoal(goalId)
  const parts =
    'parts' in input
      ? input.parts
      : [
          {
            walletId: input.walletId,
            amount:
              input.amount ?? (await heldInWalletFor(goal, input.walletId)),
          },
        ]
  const spending = parts.filter((p) => p.amount > 0)
  for (const p of spending)
    if (!(await walletCurrency(p.walletId)))
      throw new MoneyActionError('no_wallet')
  const date = input.date ?? isoOf(new Date())
  const ids: string[] = []
  for (const p of spending)
    ids.push(
      await recordGoalSpend(await liveGoal(goalId), {
        amount: p.amount,
        walletId: p.walletId,
        categoryId: input.categoryId,
        date,
      }),
    )
  await closeGoal(goalId, { closedAt: date, leftover: { kind: 'free' } })
  return ids
}
