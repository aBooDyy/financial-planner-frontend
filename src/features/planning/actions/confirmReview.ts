/**
 * The payday review's two answers (03 §4): **Set aside** confirms every ticked line as a
 * set-aside in its chosen wallet (at its edited amount) and records one transfer per ticked
 * destination; **Not now** takes the waiting lines out of the review queue, leaving them in
 * Needs confirming. Unticked lines stay as they are.
 */
import { isoOf } from '#/features/planned/data/dates'
import {
  confirmPlanned,
  dismissFromReview,
} from '#/features/planned/data/mutations'
import { createTransfer } from '#/features/transactions/data/transfers'
import type { TransferDraft } from '#/features/transactions/data/transfers'

export type ReviewedLine = {
  plannedId: string
  /** In the line's currency. */
  amount: number
  walletId: string | null
}

export async function confirmReview(
  lines: ReadonlyArray<ReviewedLine>,
  transfers: ReadonlyArray<Omit<TransferDraft, 'date' | 'note'>>,
  options: { date?: string; note?: string | null } = {},
): Promise<number> {
  const date = options.date ?? isoOf(new Date())
  let made = 0
  for (const t of transfers)
    await createTransfer({ ...t, date, note: options.note ?? null })
  for (const line of lines) {
    if (line.amount <= 0) continue
    await confirmPlanned(line.plannedId, {
      amount: line.amount,
      walletId: line.walletId,
      date,
    })
    made += 1
  }
  return made
}

/** "Not now": out of the queue, still in Needs confirming. */
export const postponeReview = (plannedIds: ReadonlyArray<string>) =>
  dismissFromReview(plannedIds)
