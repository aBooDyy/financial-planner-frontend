import type {
  ExtractField,
  Extraction,
  FieldReading,
} from '#/features/email-sync/api/types'
import { formatMoney } from '#/lib/currency'

export type ReadingTone = 'ok' | 'warn' | 'idle'

const PROBLEM: Record<
  ExtractField,
  Partial<Record<FieldReading['status'], string>>
> = {
  amount: {
    anchor_not_found: 'Couldn’t find the amount’s line',
    no_number: 'No number on the amount’s line',
    out_of_range: 'The number read is too large to be an amount',
    not_set: 'No amount picked',
  },
  currency: {
    anchor_not_found: 'Couldn’t find the currency’s line',
    no_currency: 'No currency found',
    not_set: 'No currency picked',
  },
  merchant: {
    anchor_not_found: 'Merchant line not found',
    not_set: 'Tag its line in step 1',
  },
}

/** One field's reading in words: its value, or what went wrong. */
export function fieldText(field: ExtractField, reading: FieldReading): string {
  if (reading.status === 'ok' || reading.status === 'heuristic')
    return reading.raw ?? ''
  return PROBLEM[field][reading.status] ?? 'Not read'
}

export const fieldTone = (reading: FieldReading): ReadingTone =>
  reading.status === 'ok' || reading.status === 'heuristic'
    ? 'ok'
    : reading.status === 'not_set'
      ? 'idle'
      : 'warn'

/** The money an extraction read, formatted in its own currency; null when incomplete. */
export const moneyText = (extraction: Extraction): string | null =>
  extraction.amount !== null && extraction.currency
    ? formatMoney(extraction.amount, extraction.currency)
    : null

/** A one-line summary for a list of emails: "SAR 38.50 · Jarir" or the first problem. */
export function extractionLine(extraction: Extraction): string {
  const money = moneyText(extraction)
  if (!money) {
    const failing = (['amount', 'currency'] as const).find(
      (f) => fieldTone(extraction.fields[f]) !== 'ok',
    )
    return failing ? fieldText(failing, extraction.fields[failing]) : 'Not read'
  }
  return extraction.merchant ? `${money} · ${extraction.merchant}` : money
}

/** "Read 11 of 12 similar emails" — how well the template holds across its group. */
export function groupScore(similar: Extraction[]): {
  read: number
  total: number
} {
  return {
    read: similar.filter((e) => e.complete).length,
    total: similar.length,
  }
}
