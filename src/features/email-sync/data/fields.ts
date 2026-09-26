import type {
  ExtractField,
  FieldPicks,
  LearnOptions,
} from '#/features/email-sync/api/types'
import { currencyPickNeeded } from './mapping'

export const FIELD_LABEL: Record<ExtractField, string> = {
  amount: 'Amount',
  currency: 'Currency',
  merchant: 'Merchant',
}

/** The fields a tap can fill under these options: a fixed currency is never tapped. */
export const tappableFields = (options: LearnOptions): ExtractField[] =>
  currencyPickNeeded(options)
    ? ['amount', 'currency', 'merchant']
    : ['amount', 'merchant']

/** Which fields each line carries, for the marks beside it. */
export function lineMarks(
  picks: FieldPicks,
  options: LearnOptions,
): Map<number, ExtractField[]> {
  const marks = new Map<number, ExtractField[]>()
  for (const field of tappableFields(options)) {
    const pick = picks[field]
    if (!pick) continue
    marks.set(pick.line, [...(marks.get(pick.line) ?? []), field])
  }
  return marks
}
