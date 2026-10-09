import { fromWireCurrencyOrNull } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/**
 * A template is how a rule reads lines of text — an email's body, a forwarded SMS — learned by
 * the server from the values the user tapped on a sample. Internal values are lowercase; the
 * wire is the backend's UPPER_SNAKE name, translated only here.
 */
export type DecimalStyleWire = 'AUTO' | 'DOT' | 'COMMA'
export type CurrencyModeWire = 'FROM_EMAIL' | 'FIXED'
export type ReadingStatusWire =
  | 'OK'
  | 'ANCHOR_NOT_FOUND'
  | 'NO_NUMBER'
  | 'OUT_OF_RANGE'
  | 'NO_CURRENCY'
  | 'HEURISTIC'
  | 'NOT_SET'
export type LabelSourceWire = 'PICKED' | 'SAME_LINE' | 'NEARBY' | 'KEYWORDS'

const lower = <T extends string>(w: string): T => w.toLowerCase() as T
const upper = <T extends string>(v: string): T => v.toUpperCase() as T

/** What a template reads: the lines a tap lands on. */
export type TextSample = { bodyLines: string[] }

export type DecimalStyle = 'auto' | 'dot' | 'comma'
/** `from_email` reads the currency from the sample's own lines, whatever they came from. */
export type CurrencyMode = 'from_email' | 'fixed'

/**
 * The words a value is found by, and where it sits from them: `offset` lines after the label's
 * line (0 = on the same line, after the label).
 */
export type TemplateLabel = { text: string; offset: number }

export type AmountSpec = {
  /** Null reads the amount by keywords alone. */
  label: TemplateLabel | null
  /** Which number on the value line; null reads the one next to the currency. */
  numberIndex: number | null
  decimal: DecimalStyle
}

export type CurrencySpec =
  | {
      mode: 'from_email'
      label: TemplateLabel | null
      code: CurrencyCode | null
    }
  | { mode: 'fixed'; code: CurrencyCode }

/** How a rule reads a sample — learned from the user's picks on it. */
export type ExtractionTemplate = {
  kind: string
  amount: AmountSpec
  currency: CurrencySpec
  merchant: { label: TemplateLabel } | null
}

export type ReadingStatus = Lowercase<ReadingStatusWire>

export type FieldReading = {
  status: ReadingStatus
  raw: string | null
  /** Index into the sample's lines. */
  line: number | null
}

export type ExtractField = 'amount' | 'currency' | 'merchant'

export type Extraction = {
  /** Minor units of `currency`; null unless both were read. */
  amount: number | null
  currency: CurrencyCode | null
  merchant: string | null
  complete: boolean
  fields: Record<ExtractField, FieldReading>
}

/**
 * The value the user tapped: a whole line, or a span inside it. `labelLine` is the line the
 * user says labels it; left out, the server finds the label itself.
 */
export type FieldPick = {
  line: number
  start?: number
  end?: number
  labelLine?: number
}

export type FieldPicks = {
  amount: FieldPick | null
  currency: FieldPick | null
  merchant: FieldPick | null
}

export type LearnOptions = {
  decimal: DecimalStyle
  currency: { mode: CurrencyMode; code: CurrencyCode | null }
}

/** The taps and options a template is learned from, on a sample and its look-alikes. */
export type LearnRequest<TSample extends TextSample = TextSample> = {
  sample: TSample
  picks: FieldPicks & { amount: FieldPick }
  options: LearnOptions
  similar: TSample[]
}

export type LabelSource = Lowercase<LabelSourceWire>

/** How the learned rule finds one field on the sample. */
export type LearnedLabel = {
  /** The label's line in the sample; null (with `text` and `offset`) when read by keywords. */
  line: number | null
  /** The label as the sample writes it. */
  text: string | null
  offset: number | null
  source: LabelSource
  /** Reading the sample again with the rule gives back what was tapped. */
  verified: boolean
}

/** Null for a field that was not tapped, or a fixed currency. */
export type LearnedLabels = Record<ExtractField, LearnedLabel | null>

/** What a learn answers that every caller reads: the template, its labels, the sample read. */
export type Learned = {
  template: ExtractionTemplate
  reading: Extraction
  labels: LearnedLabels
}

// --- Wire -----------------------------------------------------------------------------

export type TemplateLabelWire = { text: string; offset: number }

export type TemplateWire = {
  kind: string
  amount: {
    label: TemplateLabelWire | null
    number_index: number | null
    decimal: DecimalStyleWire
  }
  currency:
    | {
        mode: 'FROM_EMAIL'
        label: TemplateLabelWire | null
        code: string | null
      }
    | { mode: 'FIXED'; code: string }
  merchant: { label: TemplateLabelWire } | null
}

export type FieldReadingWire = {
  status: ReadingStatusWire
  raw: string | null
  line: number | null
}

export type ExtractionWire = {
  amount: number | null
  currency: string | null
  merchant: string | null
  complete: boolean
  fields: Record<ExtractField, FieldReadingWire>
}

export type FieldPickWire = {
  line: number
  start?: number
  end?: number
  label_line: number | null
}

export type FieldPicksWire = {
  amount: FieldPickWire
  currency: FieldPickWire | null
  merchant: FieldPickWire | null
}

export type LearnOptionsWire = {
  decimal: DecimalStyleWire
  currency: { mode: CurrencyModeWire; code: string | null }
}

export type LearnedLabelWire = {
  line: number | null
  text: string | null
  offset: number | null
  source: LabelSourceWire
  verified: boolean
}

export type LearnedWire = {
  template: TemplateWire
  reading: ExtractionWire
  labels: Record<ExtractField, LearnedLabelWire | null>
}

// --- Mappers --------------------------------------------------------------------------

const toLabel = (w: TemplateLabelWire): TemplateLabel => ({
  text: w.text,
  offset: w.offset,
})

const toLabelOrNull = (w: TemplateLabelWire | null): TemplateLabel | null =>
  w ? toLabel(w) : null

const toLabelWire = (l: TemplateLabel): TemplateLabelWire => ({
  text: l.text,
  offset: l.offset,
})

const toLabelWireOrNull = (
  l: TemplateLabel | null,
): TemplateLabelWire | null => (l ? toLabelWire(l) : null)

export const toTemplate = (w: TemplateWire): ExtractionTemplate => ({
  kind: w.kind,
  amount: {
    label: toLabelOrNull(w.amount.label),
    numberIndex: w.amount.number_index,
    decimal: lower<DecimalStyle>(w.amount.decimal),
  },
  currency:
    w.currency.mode === 'FIXED'
      ? { mode: 'fixed', code: w.currency.code }
      : {
          mode: 'from_email',
          label: toLabelOrNull(w.currency.label),
          code: fromWireCurrencyOrNull(w.currency.code),
        },
  merchant: w.merchant ? { label: toLabel(w.merchant.label) } : null,
})

export const toTemplateWire = (t: ExtractionTemplate): TemplateWire => ({
  kind: t.kind,
  amount: {
    label: toLabelWireOrNull(t.amount.label),
    number_index: t.amount.numberIndex,
    decimal: upper<DecimalStyleWire>(t.amount.decimal),
  },
  currency:
    t.currency.mode === 'fixed'
      ? { mode: 'FIXED', code: t.currency.code }
      : {
          mode: 'FROM_EMAIL',
          label: toLabelWireOrNull(t.currency.label),
          code: t.currency.code,
        },
  merchant: t.merchant ? { label: toLabelWire(t.merchant.label) } : null,
})

const toReading = (w: FieldReadingWire): FieldReading => ({
  status: lower<ReadingStatus>(w.status),
  raw: w.raw,
  line: w.line,
})

export const toExtraction = (w: ExtractionWire): Extraction => ({
  amount: w.amount,
  currency: fromWireCurrencyOrNull(w.currency),
  merchant: w.merchant,
  complete: w.complete,
  fields: {
    amount: toReading(w.fields.amount),
    currency: toReading(w.fields.currency),
    merchant: toReading(w.fields.merchant),
  },
})

export const toPickWire = (p: FieldPick): FieldPickWire => ({
  line: p.line,
  ...(p.start !== undefined && p.end !== undefined
    ? { start: p.start, end: p.end }
    : {}),
  label_line: p.labelLine ?? null,
})

const toPickWireOrNull = (p: FieldPick | null): FieldPickWire | null =>
  p ? toPickWire(p) : null

export const toPicksWire = (picks: LearnRequest['picks']): FieldPicksWire => ({
  amount: toPickWire(picks.amount),
  currency: toPickWireOrNull(picks.currency),
  merchant: toPickWireOrNull(picks.merchant),
})

export const toLearnOptionsWire = (o: LearnOptions): LearnOptionsWire => ({
  decimal: upper<DecimalStyleWire>(o.decimal),
  currency: {
    mode: upper<CurrencyModeWire>(o.currency.mode),
    code: o.currency.code,
  },
})

const toLearnedLabel = (w: LearnedLabelWire | null): LearnedLabel | null =>
  w
    ? {
        line: w.line,
        text: w.text,
        offset: w.offset,
        source: lower<LabelSource>(w.source),
        verified: w.verified,
      }
    : null

export const toLearned = (w: LearnedWire): Learned => ({
  template: toTemplate(w.template),
  reading: toExtraction(w.reading),
  labels: {
    amount: toLearnedLabel(w.labels.amount),
    currency: toLearnedLabel(w.labels.currency),
    merchant: toLearnedLabel(w.labels.merchant),
  },
})
