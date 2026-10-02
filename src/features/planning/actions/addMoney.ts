/**
 * "Add money" — set aside any amount for a bill or goal, from any wallet(s) or held outside,
 * on or off plan (02 Anytime actions). For a bill the money fills its current occurrence and
 * spills into the next ones in order; one set-aside is written per wallet and occurrence. Money
 * added counts against the owner's oldest set-asides waiting to be confirmed first, so it
 * settles the plan rather than sitting beside it, and the plan is then rewritten quietly — being
 * ahead lowers what later paydays set aside.
 */
import { db } from '#/db/db'
import type { LocalBill, LocalPlanned } from '#/db/types'
import { isoOf } from '#/features/planned/data/dates'
import {
  readBillNeeds,
  walletCurrency,
} from '#/features/planned/data/mutations'
import { isSetAsideFor } from '#/features/planned/data/owners'
import type { PlanOwner } from '#/features/planned/data/owners'
import { requestPlanRecalc } from '#/features/planned/data/recalcRequests'
import { currentRates, settlementsOf } from '#/features/planned/data/rows'
import {
  dueList,
  indexSettlements,
  remainderOf,
} from '#/features/planned/data/settle'
import { spill } from '#/features/planning/data/fill'
import type { OccurrenceNeed } from '#/features/planning/data/fill'
import { createSetAside } from '#/features/setAsides/data/mutations'
import type { SetAsideOwner } from '#/features/setAsides/data/mutations'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { MoneyActionError } from './errors'

/** One row of the Add money sheet (or of its Split), in the owner's currency. */
export type MoneyPart =
  | { walletId: string; amount: number }
  | { externalLabel: string; amount: number }

export type AddMoneyOptions = { date?: string; note?: string | null }

type Owned = { currency: CurrencyCode; bill: LocalBill | null }

async function ownerOf(owner: PlanOwner): Promise<Owned> {
  if (owner.kind === 'goal') {
    const goal = await db.goals.get(owner.id)
    if (!goal || goal.deleted !== 0) throw new MoneyActionError('not_found')
    if (goal.closedAt !== null) throw new MoneyActionError('closed')
    return { currency: goal.currency, bill: null }
  }
  const bill = await db.bills.get(owner.id)
  if (!bill || bill.deleted !== 0) throw new MoneyActionError('not_found')
  if (bill.closedAt !== null) throw new MoneyActionError('closed')
  return { currency: bill.currency, bill }
}

/** The owner's planned set-asides waiting to be confirmed, oldest first, with what is open. */
async function waitingRows(
  owner: PlanOwner,
  today: string,
  rates: RatesMap,
): Promise<Array<{ row: LocalPlanned; open: number }>> {
  const link = owner.kind === 'goal' ? 'goalId' : 'billId'
  const rows = dueList(
    (
      await db.plannedTransactions.where(link).equals(owner.id).toArray()
    ).filter((p) => isSetAsideFor(p, owner)),
    today,
  )
  const { txns, setAsides } = await settlementsOf(rows.map((r) => r.id))
  const index = indexSettlements(txns, setAsides)
  return rows.map((row) => ({ row, open: remainderOf(row, index, rates) }))
}

/** Take the oldest waiting row with something open for `amount` (owner currency). */
function linkFor(
  waiting: Array<{ row: LocalPlanned; open: number }>,
  amount: number,
): string | null {
  const next = waiting.find((w) => w.open > 0)
  if (!next) return null
  next.open -= amount
  return next.row.id
}

function take(needs: OccurrenceNeed[], amount: number) {
  const chunks = spill(needs, amount)
  for (const chunk of chunks) {
    const need = needs.find((n) => n.occurrence === chunk.occurrence)
    if (need) need.need = Math.max(0, need.need - chunk.amount)
  }
  return chunks
}

export async function addMoney(
  owner: PlanOwner,
  parts: ReadonlyArray<MoneyPart>,
  options: AddMoneyOptions = {},
): Promise<string[]> {
  if (parts.some((p) => !Number.isFinite(p.amount) || p.amount <= 0))
    throw new MoneyActionError('bad_amount')
  const { currency, bill } = await ownerOf(owner)
  const rates = await currentRates()
  const date = options.date ?? isoOf(new Date())
  const waiting = await waitingRows(owner, date, rates)
  const needs = bill ? await readBillNeeds(bill, rates) : []

  const ids: string[] = []
  for (const part of parts) {
    const inWallet =
      'walletId' in part ? await walletCurrency(part.walletId) : currency
    if (!inWallet) throw new MoneyActionError('no_wallet')
    const where =
      'walletId' in part
        ? {
            source: 'wallet' as const,
            walletId: part.walletId,
            externalLabel: null,
          }
        : {
            source: 'outside' as const,
            walletId: null,
            externalLabel: part.externalLabel,
          }
    const slices: Array<{ to: SetAsideOwner; amount: number }> = bill
      ? take(needs, part.amount).map((c) => ({
          to: { billId: bill.id, occurrence: c.occurrence },
          amount: c.amount,
        }))
      : [{ to: { goalId: owner.id }, amount: part.amount }]
    if (bill && slices.length === 0) throw new MoneyActionError('closed')
    for (const slice of slices) {
      ids.push(
        await createSetAside(slice.to, {
          ...where,
          amount: convertMinor(slice.amount, currency, inWallet, rates),
          currency: inWallet,
          note: options.note ?? null,
          date,
          plannedId: linkFor(waiting, slice.amount),
        }),
      )
    }
  }
  requestPlanRecalc(owner, { quiet: true })
  return ids
}
