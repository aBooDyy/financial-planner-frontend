/**
 * The leftover prompt's three answers (03 §5), for money a settled occurrence still holds:
 *
 * - **move** — "Move it to <paying wallet>": records a transfer from each wallet that held some
 *   and releases those set-asides by its outgoing leg — the transaction that took the money to
 *   the payment — so they read as used, not freed. What the paying wallet itself still holds is
 *   released without a transfer. Money held outside the app cannot ride a transfer and is left
 *   as it is.
 * - **free** — releases them where they are; that wallet's free money goes up.
 * - **keep** — repeating bills only: they move to the next open occurrence.
 */
import { db } from '#/db/db'
import { isoOf } from '#/features/planned/data/dates'
import { currentRates } from '#/features/planned/data/rows'
import type { LeftoverReport } from '#/features/planning/data/leftover'
import {
  moveSetAsides,
  releaseSetAsides,
} from '#/features/setAsides/data/batches'
import {
  createTransfer,
  heldLegs,
} from '#/features/transactions/data/transfers'
import { convertMinor } from '#/lib/currency'
import { MoneyActionError } from './errors'

export type LeftoverChoice = 'move' | 'free' | 'keep'

export async function resolveLeftover(
  report: LeftoverReport,
  choice: LeftoverChoice,
  options: { payingWalletId: string; date?: string },
): Promise<void> {
  const date = options.date ?? isoOf(new Date())
  if (choice === 'free') {
    await releaseSetAsides(
      report.lines.flatMap((l) => l.ids.map((id) => ({ id }))),
      { releasedAt: date },
    )
    return
  }
  if (choice === 'keep') {
    const next = report.nextOccurrence
    if (!report.canKeep || !next)
      throw new MoneyActionError('no_next_occurrence')
    await moveSetAsides(
      report.lines.flatMap((l) =>
        l.ids.map((id) => ({
          id,
          to: { owner: { billId: report.billId, occurrence: next } },
        })),
      ),
      { date },
    )
    return
  }
  const paying = await db.balanceNodes.get(options.payingWalletId)
  if (!paying || paying.deleted !== 0 || paying.kind !== 'wallet')
    throw new MoneyActionError('no_wallet')
  const bill = await db.bills.get(report.billId)
  const rates = await currentRates()
  for (const line of report.lines) {
    if (!line.walletId) continue
    if (line.walletId === paying.id) {
      await releaseSetAsides(
        line.ids.map((id) => ({ id })),
        { releasedAt: date },
      )
      continue
    }
    const toCurrency = paying.currency ?? line.currency
    const transferId = await createTransfer({
      fromWalletId: line.walletId,
      toWalletId: paying.id,
      amount: line.amount,
      fromCurrency: line.currency,
      toAmount: convertMinor(line.amount, line.currency, toCurrency, rates),
      toCurrency,
      date,
      note: bill?.name ?? null,
    })
    await releaseSetAsides(
      line.ids.map((id) => ({ id })),
      {
        releasedAt: date,
        releasedById: (await heldLegs(transferId)).out?.id ?? null,
      },
    )
  }
}
