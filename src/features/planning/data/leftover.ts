/**
 * What a bill payment left set aside elsewhere: the occurrence's live set-asides outside the
 * paying wallet (other wallets, or held outside the app). The leftover prompt (03 §5) offers to
 * move them to the paying wallet, free them, or — on a repeating bill — keep them for the next
 * occurrence; nothing happens to them until the user picks.
 */
import type { LocalBill, LocalPlanned, LocalSetAside } from '#/db/types'
import { addMonthsISO } from '#/features/planned/data/dates'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { billOccurrences, isSettledOccurrence } from './occurrences'

/** One wallet's (or one outside label's) leftover for the occurrence. */
export type LeftoverLine = {
  walletId: string | null
  externalLabel: string | null
  /** In `currency` — the line's first row's. */
  amount: number
  currency: CurrencyCode
  /** The set-aside rows it sums. */
  ids: string[]
}

export type LeftoverReport = {
  billId: string
  occurrence: string
  lines: LeftoverLine[]
  /** Σ lines in the bill's currency. */
  total: number
  /** "Keep it for next time" — repeating, open bills only. */
  canKeep: boolean
  /** The occurrence "keep" moves the money to. */
  nextOccurrence: string | null
}

/** The first open occurrence after `occurrence`, within two years. */
function nextOpenAfter(
  bill: LocalBill,
  occurrence: string,
  payments: ReadonlyMap<string, LocalPlanned>,
): string | null {
  if (bill.frequency === null) return null
  return (
    billOccurrences(bill, addMonthsISO(occurrence, 24)).find(
      (o) => o > occurrence && !isSettledOccurrence(payments, o),
    ) ?? null
  )
}

export function leftoverFor(args: {
  bill: LocalBill
  occurrence: string
  payingWalletId: string
  setAsides: ReadonlyArray<LocalSetAside>
  /** The bill's planned payment rows by occurrence (`paymentRowsOf`). */
  payments: ReadonlyMap<string, LocalPlanned>
  rates: RatesMap
}): LeftoverReport {
  const { bill, occurrence, rates } = args
  const byPlace = new Map<string, LeftoverLine>()
  for (const a of args.setAsides) {
    if (
      !isLiveSetAside(a) ||
      a.billId !== bill.id ||
      a.occurrence !== occurrence
    )
      continue
    if (a.source === 'wallet' && a.walletId === args.payingWalletId) continue
    const key =
      a.source === 'wallet' ? `w:${a.walletId}` : `o:${a.externalLabel}`
    const line = byPlace.get(key)
    if (line) {
      line.amount += convertMinor(a.amount, a.currency, line.currency, rates)
      line.ids.push(a.id)
      continue
    }
    byPlace.set(key, {
      walletId: a.source === 'wallet' ? a.walletId : null,
      externalLabel: a.source === 'outside' ? a.externalLabel : null,
      amount: a.amount,
      currency: a.currency,
      ids: [a.id],
    })
  }
  const lines = [...byPlace.values()].sort((x, y) => y.amount - x.amount)
  const canKeep = bill.frequency !== null && bill.closedAt === null
  return {
    billId: bill.id,
    occurrence,
    lines,
    total: lines.reduce(
      (sum, l) =>
        sum + convertMinor(l.amount, l.currency, bill.currency, rates),
      0,
    ),
    canKeep,
    nextOccurrence: canKeep
      ? nextOpenAfter(bill, occurrence, args.payments)
      : null,
  }
}
