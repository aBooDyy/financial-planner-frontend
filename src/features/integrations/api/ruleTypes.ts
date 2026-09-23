/**
 * The rule schema is server-owned: the backend validates it on every write and evaluates it
 * on every delivery. These types mirror its wire shape, which is already the shape the editor
 * builds field by field, so the only translation here is the match condition's
 * `ignore_case` and the rule set's envelope.
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

export type IntegrationRule = {
  /** Null until the server has saved it. */
  id: string | null
  name: string
  match: MatchCondition | null
  fields: Partial<Record<LocatorField, Locator>>
}

export type RuleSet = { version: string; rules: IntegrationRule[] }

type FieldStatus =
  | 'OK'
  | 'PATH_NOT_FOUND'
  | 'REGEX_NO_MATCH'
  | 'REGEX_TIMEOUT'
  | 'COERCION_FAILED'
  | 'UNRESOLVED'

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
    category: string | null
    subcategory: string | null
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

export type RuleWire = {
  id?: string
  name: string
  match: MatchWire | null
  fields: Partial<Record<LocatorField, Locator>>
}

type RuleResponseWire = {
  id: string
  position: number
  name: string
  match: MatchWire | null
  fields: Partial<Record<LocatorField, Locator>>
}

export type RuleSetWire = { version: string; rules: RuleResponseWire[] }

export type ExtractionWire = {
  fields: Partial<Record<LocatorField, FieldReport>>
  values: Omit<ExtractedValues, 'externalId'> & { external_id: string | null }
  missing: LocatorField[]
  resolved: {
    wallet_id: string | null
    category: string | null
    subcategory: string | null
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

export const toRuleSet = (w: RuleSetWire): RuleSet => ({
  version: w.version,
  rules: [...w.rules]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      match: toMatch(r.match),
      fields: r.fields,
    })),
})

export const toRuleWire = (r: IntegrationRule): RuleWire => ({
  ...(r.id ? { id: r.id } : {}),
  name: r.name,
  match: r.match ? toMatchWire(r.match) : null,
  fields: r.fields,
})

export const toExtraction = (w: ExtractionWire): Extraction => {
  const { external_id, ...values } = w.values
  return {
    fields: w.fields,
    values: { ...values, externalId: external_id },
    missing: w.missing,
    resolved: {
      walletId: w.resolved.wallet_id,
      category: w.resolved.category,
      subcategory: w.resolved.subcategory,
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
