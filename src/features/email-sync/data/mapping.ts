import { numberTokens } from '#/lib/lineTokens'
import type {
  EmailSample,
  ExtractField,
  ExtractionTemplate,
  FieldPick,
  FieldPicks,
  LearnOptions,
  LearnRequest,
} from '#/features/email-sync/api/types'

/** The user's taps on one sample, and the reading options — what a template is learned from. */
export type Mapping = {
  sample: EmailSample | null
  /** The sample's group, read with the learned template to prove it. */
  similar: EmailSample[]
  picks: FieldPicks
  options: LearnOptions
}

export const NO_PICKS: FieldPicks = {
  amount: null,
  currency: null,
  merchant: null,
}

/** Reading options start from what the rule already knows. */
export const optionsFrom = (
  template: ExtractionTemplate | null,
): LearnOptions => ({
  decimal: template?.amount.decimal ?? 'auto',
  currency:
    template?.currency.mode === 'fixed'
      ? { mode: 'fixed', code: template.currency.code }
      : { mode: 'from_email', code: null },
})

export const blankMapping = (template: ExtractionTemplate | null): Mapping => ({
  sample: null,
  similar: [],
  picks: NO_PICKS,
  options: optionsFrom(template),
})

/** A fixed currency needs no pick — its line is never read. */
export const currencyPickNeeded = (options: LearnOptions): boolean =>
  options.currency.mode === 'from_email'

/**
 * Where a tap goes next: amount and currency hop to each other until both are set, then to
 * nothing. The merchant is optional, so it is only ever the target because the user chose it.
 */
export function nextTarget(
  mapping: Mapping,
  after: ExtractField,
): ExtractField | null {
  const { picks, options } = mapping
  if (after === 'merchant') return 'merchant'
  if (after === 'amount')
    return currencyPickNeeded(options) && !picks.currency ? 'currency' : null
  return picks.amount ? null : 'amount'
}

export const firstTarget = (mapping: Mapping): ExtractField | null =>
  !mapping.picks.amount
    ? 'amount'
    : currencyPickNeeded(mapping.options) && !mapping.picks.currency
      ? 'currency'
      : null

export const withPick = (
  mapping: Mapping,
  field: ExtractField,
  pick: FieldPick | null,
): Mapping => ({ ...mapping, picks: { ...mapping.picks, [field]: pick } })

/** A refined pick on the same line keeps the label the user chose for it; a new line does not. */
export const keepLabelLine = (
  previous: FieldPick | null,
  next: FieldPick,
): FieldPick =>
  previous?.labelLine !== undefined && previous.line === next.line
    ? { ...next, labelLine: previous.labelLine }
    : next

/** Sets (or, with undefined, clears) the line the user says labels `field`. */
export function withLabelLine(
  mapping: Mapping,
  field: ExtractField,
  line: number | undefined,
): Mapping {
  const pick = mapping.picks[field]
  if (!pick) return mapping
  const { labelLine: _previous, ...value } = pick
  return withPick(
    mapping,
    field,
    line === undefined ? value : { ...value, labelLine: line },
  )
}

/** The learn call these picks make, or null while one is still missing. */
export function learnRequestOf(mapping: Mapping): LearnRequest | null {
  const { sample, picks, options } = mapping
  if (!sample || !picks.amount) return null
  if (currencyPickNeeded(options) && !picks.currency) return null
  if (options.currency.mode === 'fixed' && !options.currency.code) return null
  return {
    sample,
    picks: {
      amount: picks.amount,
      currency: currencyPickNeeded(options) ? picks.currency : null,
      merchant: picks.merchant,
    },
    options,
    similar: mapping.similar,
  }
}

/** Identifies one learn request, so an answer is only ever applied to what it answers. */
export const signatureOf = (request: LearnRequest | null): string | null =>
  request ? JSON.stringify(request) : null

/**
 * A tap on a line, as a pick for `field`. An amount line holding exactly one number pins it
 * by span; with several, the line alone is picked and the user says which number it is.
 */
export function pickForLine(
  line: string,
  index: number,
  field: ExtractField,
): FieldPick {
  if (field !== 'amount') return { line: index }
  const tokens = numberTokens(line)
  return tokens.length === 1
    ? { line: index, start: tokens[0].start, end: tokens[0].end }
    : { line: index }
}
