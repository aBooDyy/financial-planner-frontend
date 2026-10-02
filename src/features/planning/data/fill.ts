/**
 * Fill-then-spill: money set aside for a bill fills its earliest open occurrence that still
 * needs money, then the next, in order (02 Anytime actions). Pure.
 */
import type { LocalBill, LocalPlanned, LocalSetAside } from '#/db/types'
import { addMonthsISO } from '#/features/planned/data/dates'
import { settledOf } from '#/features/planned/data/settle'
import type { SettlementIndex } from '#/features/planned/data/settle'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { convertMinor } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { billOccurrences, isSettledOccurrence } from './occurrences'

/** What an open occurrence still needs, in the bill's currency. */
export type OccurrenceNeed = { occurrence: string; need: number }

/** A slice of money for one occurrence, in the bill's currency. */
export type OccurrenceChunk = { occurrence: string; amount: number }

/** How far ahead an amount may spill — prepaying years of a monthly bill is still covered. */
const SPILL_YEARS = 10

/** The bill's open occurrences from `nextDue` on and what each still needs. */
export function occurrenceNeeds(
  bill: LocalBill,
  payments: ReadonlyMap<string, LocalPlanned>,
  setAsides: ReadonlyArray<LocalSetAside>,
  index: SettlementIndex,
  rates: RatesMap,
): OccurrenceNeed[] {
  const held = new Map<string, number>()
  for (const a of setAsides) {
    if (a.billId !== bill.id || !a.occurrence || !isLiveSetAside(a)) continue
    held.set(
      a.occurrence,
      (held.get(a.occurrence) ?? 0) +
        convertMinor(a.amount, a.currency, bill.currency, rates),
    )
  }
  const through = addMonthsISO(bill.nextDue, SPILL_YEARS * 12)
  return billOccurrences(bill, through)
    .filter((o) => !isSettledOccurrence(payments, o))
    .map((occurrence) => {
      const row = payments.get(occurrence)
      const paid = row ? settledOf(row, index, rates) : 0
      return {
        occurrence,
        need: Math.max(0, bill.amount - paid - (held.get(occurrence) ?? 0)),
      }
    })
}

/**
 * Split `amount` across the occurrences in order, each up to its need. What is left once every
 * listed need is met stays with the last occurrence filled (the first, if none needed any).
 */
export function spill(
  needs: ReadonlyArray<OccurrenceNeed>,
  amount: number,
): OccurrenceChunk[] {
  if (needs.length === 0 || amount <= 0) return []
  const chunks: OccurrenceChunk[] = []
  let left = amount
  for (const { occurrence, need } of needs) {
    if (left <= 0) break
    const take = Math.min(need, left)
    if (take <= 0) continue
    chunks.push({ occurrence, amount: take })
    left -= take
  }
  if (left > 0) {
    const last = chunks.at(-1)
    if (last) last.amount += left
    else chunks.push({ occurrence: needs[0].occurrence, amount: left })
  }
  return chunks
}
