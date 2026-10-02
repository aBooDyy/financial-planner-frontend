/**
 * Spending a goal's money: "Use it" on a goal, and "I spent it" when marking one done (D20,
 * D30). Either records a spend linked to the goal — filed under the category the user picks,
 * remembered on the goal for next time — and releases the goal's set-asides in the paying
 * wallet, as any payment does.
 */
import { db } from '#/db/db'
import type { LocalGoal } from '#/db/types'
import { closeGoal } from '#/features/goals/data/actions'
import { updateGoal } from '#/features/goals/data/mutations'
import { isoOf } from '#/features/planned/data/dates'
import { walletCurrency } from '#/features/planned/data/mutations'
import { currentRates } from '#/features/planned/data/rows'
import { releaseForPayment } from '#/features/setAsides/data/payment'
import { setAsideFor } from '#/features/setAsides/data/totals'
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

/** "Use it": a spend from the goal. Returns the transaction's id. */
export async function spendFromGoal(
  goalId: string,
  input: GoalSpendInput,
): Promise<string> {
  const goal = await liveGoal(goalId)
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

/**
 * "I spent it" in Mark as done: a spend of everything still set aside for the goal from one
 * wallet, then the close — which frees whatever other wallets still held. Not atomic: a
 * failure between the two leaves an open goal with a payment, which is harmless and retryable.
 */
export async function markGoalSpent(
  goalId: string,
  input: Omit<GoalSpendInput, 'amount'> & { amount?: number },
): Promise<string | null> {
  const goal = await liveGoal(goalId)
  const held = setAsideFor(
    goalId,
    await db.setAsides.where('goalId').equals(goalId).toArray(),
    goal.currency,
    await currentRates(),
  )
  const amount = input.amount ?? held
  const date = input.date ?? isoOf(new Date())
  const spent =
    amount > 0 ? await spendFromGoal(goalId, { ...input, amount, date }) : null
  await closeGoal(goalId, { closedAt: date, leftover: { kind: 'free' } })
  return spent
}
