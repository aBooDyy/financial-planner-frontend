import type {
  EmailSample,
  ExtractField,
  FieldPick,
  FieldPicks,
  LearnOptions,
  LearnedLabel,
  LearnedLabels,
  TemplateLabel,
} from '#/features/email-sync/api/types'
import { tappableFields } from './fields'

/** How far from its value a label may sit — the server refuses a label line further away. */
export const LABEL_OFFSET_MAX = 3

const KEYWORD_EXAMPLES: Record<ExtractField, string> = {
  amount: 'Amount, Total…',
  currency: 'Currency…',
  merchant: 'Merchant, Payee…',
}

/** Where the label sits from its value, `offset` being how many lines the value comes after. */
export function labelPosition(offset: number): string {
  if (offset === 0) return 'same line'
  const lines = Math.abs(offset)
  const side = offset > 0 ? 'above' : 'below'
  return lines === 1 ? `line ${side}` : `${lines} lines ${side}`
}

export const keywordsText = (field: ExtractField): string =>
  `Read by keywords (${KEYWORD_EXAMPLES[field]})`

/** The label a learned rule found for a field, or null when it reads the field by keywords. */
export function foundLabel(
  label: LearnedLabel,
): { text: string; position: string } | null {
  if (
    label.source === 'keywords' ||
    label.text === null ||
    label.offset === null
  )
    return null
  return { text: label.text, position: labelPosition(label.offset) }
}

export const LABEL_UNVERIFIED = 'Couldn’t find this again — tap the label line'

/** The rule's label for one field, in the words a rule row reads. */
export function describeLabel(label: TemplateLabel | null): string {
  if (!label) return 'by keywords'
  const quoted = `“${label.text}”`
  if (label.offset === 0) return `after ${quoted}`
  const lines = Math.abs(label.offset)
  const side = label.offset > 0 ? 'below' : 'above'
  return lines === 1 ? `${side} ${quoted}` : `${lines} lines ${side} ${quoted}`
}

const LETTER = /\p{L}/u
const DIGIT = /\p{Nd}/u
/** A bare ISO code before the value ("SAR 38.50") is not a label. */
const LEADING_CODE = /^\s*[A-Z]{3}(?![A-Za-z])/

/** The text a value line carries before its value — where a same-line label would be. */
function leadOf(line: string, pick: FieldPick, field: ExtractField): string {
  if (pick.start !== undefined) return line.slice(0, pick.start)
  if (field === 'merchant') {
    const colon = line.indexOf(':')
    return colon < 0 ? '' : line.slice(0, colon)
  }
  const digit = line.search(DIGIT)
  return digit < 0 ? '' : line.slice(0, digit)
}

/**
 * The lines a user may tap as `field`'s label: within `LABEL_OFFSET_MAX` of the value, with a
 * word before any digit — and the value's own line only when words precede the value.
 */
export function labelCandidates(
  lines: string[],
  pick: FieldPick,
  field: ExtractField,
): Set<number> {
  const out = new Set<number>()
  const from = Math.max(0, pick.line - LABEL_OFFSET_MAX)
  const to = Math.min(lines.length - 1, pick.line + LABEL_OFFSET_MAX)
  for (let index = from; index <= to; index += 1) {
    const line = lines[index] ?? ''
    const raw = index === pick.line ? leadOf(line, pick, field) : line
    const text = raw.replace(LEADING_CODE, '')
    const digit = text.search(DIGIT)
    if (LETTER.test(digit < 0 ? text : text.slice(0, digit))) out.add(index)
  }
  return out
}

/** The next tap names this field's label, and only these lines may be tapped. */
export type LabelMode = { field: ExtractField; candidates: Set<number> }

export function labelModeOf(
  sample: EmailSample | null,
  picks: FieldPicks,
  field: ExtractField | null,
): LabelMode | null {
  const pick = field ? picks[field] : null
  if (!sample || !field || !pick) return null
  return { field, candidates: labelCandidates(sample.bodyLines, pick, field) }
}

/**
 * Which fields each line labels: the user's own label line first, else the one the learn
 * found. A value's own line is left out — it already wears the value's mark.
 */
export function labelLineMarks(
  picks: FieldPicks,
  options: LearnOptions,
  labels: LearnedLabels | null,
): Map<number, ExtractField[]> {
  const marks = new Map<number, ExtractField[]>()
  for (const field of tappableFields(options)) {
    const pick = picks[field]
    if (!pick) continue
    const line = pick.labelLine ?? labels?.[field]?.line ?? null
    if (line === null || line === pick.line) continue
    marks.set(line, [...(marks.get(line) ?? []), field])
  }
  return marks
}
