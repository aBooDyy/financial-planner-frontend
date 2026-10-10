import { fromWireTxType, toWireTxType } from '#/features/transactions/api/types'
import type { TxType, TxTypeWire } from '#/features/transactions/api/types'
import { toTemplate, toTemplateWire } from '#/features/text-templates/api/types'
import type {
  ExtractionTemplate,
  TemplateWire,
} from '#/features/text-templates/api/types'

/**
 * The rule schema is server-owned: the backend validates it on every write and evaluates it
 * on every delivery. A JSON rule's types mirror its wire shape, which is already the shape the
 * editor builds field by field; a text rule is translated like an email rule, since it reads
 * the same kind of template.
 */

export type LocatorField =
  | 'amount'
  | 'currency'
  | 'date'
  | 'merchant'
  | 'type'
  | 'category'
  | 'subcategory'
  | 'note'
  | 'external_id'
  | 'wallet'

export type AmountUnit = 'MAJOR' | 'MINOR'
export type AmountSign = 'ABSOLUTE' | 'SIGNED'
export type DateFormat = 'ISO' | 'EPOCH_S' | 'EPOCH_MS' | 'DMY' | 'MDY' | 'YMD'
export type MappedType = 'SPEND' | 'INCOME'

/**
 * Where one field lives. A flat optional bag rather than a union, because the editor builds
 * it one control at a time and a half-made locator has to be representable.
 */
export type Locator = {
  path?: string
  const?: string
  regex?: string
  group?: number
  unit?: AmountUnit
  sign?: AmountSign
  format?: DateFormat
  map?: Record<string, MappedType>
}

export type MatchOp = 'EQUALS' | 'CONTAINS' | 'EXISTS'

export type MatchCondition = {
  path: string
  op: MatchOp
  value: string
  ignoreCase: boolean
}

/** Which text messages a text rule takes: one of `textAny` (any, when empty), none of `excludeAny`. */
export type TextFilter = { textAny: string[]; excludeAny: string[] }

/** Where a text rule's message is, how it reads it, and where what it reads goes. */
export type TextRule = {
  /** The string in a JSON payload that holds the message; null for a plain-text body. */
  textPath: string | null
  filter: TextFilter
  /** Null until one is learned from taps on a sample. */
  template: ExtractionTemplate | null
  walletId: string | null
  type: TxType
  categoryId: string | null
  /** Filed as the merchant when a message names none. */
  defaultMerchant: string
}

/**
 * A JSON rule reads a payload through `match` and `fields`; a text rule (`text` set) reads a
 * text message through its learned template, and leaves those two empty.
 */
export type IntegrationRule = {
  /** Null until the server has saved it. */
  id: string | null
  name: string
  match: MatchCondition | null
  fields: Partial<Record<LocatorField, Locator>>
  text: TextRule | null
}

export type RuleSet = { version: string; rules: IntegrationRule[] }

type FieldStatus =
  | 'OK'
  | 'PATH_NOT_FOUND'
  | 'REGEX_NO_MATCH'
  | 'REGEX_TIMEOUT'
  | 'COERCION_FAILED'
  | 'UNRESOLVED'
  | 'NOT_FOUND'

export type FieldReport = {
  value: string | number | null
  raw: string | null
  status: FieldStatus
}

type ExtractedValues = {
  date: string
  type: MappedType
  amount: number | null
  currency: string | null
  merchant: string | null
  category: string | null
  subcategory: string | null
  note: string | null
  externalId: string | null
  wallet: string | null
}

export type Extraction = {
  fields: Partial<Record<LocatorField, FieldReport>>
  values: ExtractedValues
  missing: LocatorField[]
  resolved: {
    walletId: string | null
    /** The leaf category the raw text resolved to. */
    categoryId: string | null
    /**
     * The server's snapshot of the category it resolved to, in words: the root's and the
     * child's names (a slug on a delivery logged before categories were referenced by id).
     */
    categoryText?: string | null
    subcategoryText?: string | null
  }
}

export type TraceEntry = {
  index: number
  ruleId: string | null
  name: string
  matched: boolean
  detail: string | null
}

export type DryRunOutcome = 'STAGE' | 'POST' | 'IGNORE'

export type DryRun = {
  matchedIndex: number | null
  trace: TraceEntry[]
  result: Extraction
  /** The rule being edited, read as though its condition had passed. */
  focus: {
    index: number
    matched: boolean
    detail: string | null
    result: Extraction
  } | null
  would: DryRunOutcome
}

// --- Wire -----------------------------------------------------------------------------

type MatchWire = {
  path: string
  op: MatchOp
  value?: string | null
  ignore_case?: boolean
}

type TextFilterWire = { text_any: string[]; exclude_any: string[] }

type TextRoutingWire = {
  wallet_id: string | null
  type: TxTypeWire
  category_id: string | null
  default_merchant: string | null
}

export type RuleWire =
  | {
      id?: string
      name: string
      kind: 'JSON'
      match: MatchWire | null
      fields: Partial<Record<LocatorField, Locator>>
    }
  | ({
      id?: string
      name: string
      kind: 'TEXT'
      text_path: string | null
      filter: TextFilterWire
      template: TemplateWire
    } & TextRoutingWire)

type RuleResponseWire = {
  id: string
  position: number
  name: string
  kind?: 'JSON' | 'TEXT'
  match: MatchWire | null
  fields: Partial<Record<LocatorField, Locator>>
  text_path?: string | null
  filter?: TextFilterWire | null
  template?: TemplateWire | null
  wallet_id?: string | null
  type?: TxTypeWire | null
  category_id?: string | null
  default_merchant?: string | null
}

export type RuleSetWire = { version: string; rules: RuleResponseWire[] }

export type ExtractionWire = {
  fields: Partial<Record<LocatorField, FieldReport>>
  values: Omit<ExtractedValues, 'externalId'> & { external_id: string | null }
  missing: LocatorField[]
  resolved: {
    wallet_id: string | null
    category_id: string | null
    /** Name snapshots of the resolved root and child (slugs on an old delivery). */
    category?: string | null
    subcategory?: string | null
  }
}

export type TraceEntryWire = {
  index: number
  rule_id: string | null
  name: string
  matched: boolean
  reason: string
  detail: string | null
}

export type DryRunWire = {
  matched_rule_index: number | null
  matched_rule_id: string | null
  trace: TraceEntryWire[]
  result: ExtractionWire
  focus: {
    rule_index: number
    matched: boolean
    detail: string | null
    result: ExtractionWire
  } | null
  would: DryRunOutcome
}

export type DryRunRequestWire = {
  payload: string
  rules?: RuleWire[]
  focus_index?: number
}

// --- Mappers --------------------------------------------------------------------------

const toMatch = (w: MatchWire | null): MatchCondition | null =>
  w
    ? {
        path: w.path,
        op: w.op,
        value: w.value ?? '',
        ignoreCase: w.ignore_case ?? false,
      }
    : null

const toMatchWire = (m: MatchCondition): MatchWire =>
  m.op === 'EXISTS'
    ? { path: m.path, op: m.op }
    : { path: m.path, op: m.op, value: m.value, ignore_case: m.ignoreCase }

const toTextRule = (r: RuleResponseWire): TextRule => ({
  textPath: r.text_path ?? null,
  filter: {
    textAny: r.filter?.text_any ?? [],
    excludeAny: r.filter?.exclude_any ?? [],
  },
  template: r.template ? toTemplate(r.template) : null,
  walletId: r.wallet_id ?? null,
  type: fromWireTxType(r.type ?? 'SPEND'),
  categoryId: r.category_id ?? null,
  defaultMerchant: r.default_merchant ?? '',
})

/** Whether a rule can be sent: a text rule needs the template learned from its taps. */
export const hasTemplate = (r: IntegrationRule): boolean =>
  r.text === null || r.text.template !== null

export const toRuleSet = (w: RuleSetWire): RuleSet => ({
  version: w.version,
  rules: [...w.rules]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      match: toMatch(r.match),
      fields: r.fields,
      text: r.kind === 'TEXT' ? toTextRule(r) : null,
    })),
})

/** A text rule can only be sent once it has a template — see `hasTemplate`. */
export const toRuleWire = (r: IntegrationRule): RuleWire => {
  const id = r.id ? { id: r.id } : {}
  const { text } = r
  if (!text)
    return {
      ...id,
      name: r.name,
      kind: 'JSON',
      match: r.match ? toMatchWire(r.match) : null,
      fields: r.fields,
    }
  if (!text.template) throw new Error('A text rule is sent only once learned')
  return {
    ...id,
    name: r.name,
    kind: 'TEXT',
    text_path: text.textPath,
    filter: {
      text_any: text.filter.textAny,
      exclude_any: text.filter.excludeAny,
    },
    template: toTemplateWire(text.template),
    wallet_id: text.walletId,
    type: toWireTxType(text.type),
    category_id: text.categoryId,
    default_merchant: text.defaultMerchant.trim() || null,
  }
}

export const toExtraction = (w: ExtractionWire): Extraction => {
  const { external_id, ...values } = w.values
  return {
    fields: w.fields,
    values: { ...values, externalId: external_id },
    missing: w.missing,
    resolved: {
      walletId: w.resolved.wallet_id,
      categoryId: w.resolved.category_id,
      ...(w.resolved.category !== undefined
        ? {
            categoryText: w.resolved.category,
            subcategoryText: w.resolved.subcategory ?? null,
          }
        : {}),
    },
  }
}

export const toTraceEntry = (t: TraceEntryWire): TraceEntry => ({
  index: t.index,
  ruleId: t.rule_id,
  name: t.name,
  matched: t.matched,
  detail: t.detail,
})

export const toDryRun = (w: DryRunWire): DryRun => ({
  matchedIndex: w.matched_rule_index,
  trace: w.trace.map(toTraceEntry),
  result: toExtraction(w.result),
  focus: w.focus
    ? {
        index: w.focus.rule_index,
        matched: w.focus.matched,
        detail: w.focus.detail,
        result: toExtraction(w.focus.result),
      }
    : null,
  would: w.would,
})
