import type {
  IntegrationRule,
  Locator,
  LocatorField,
  MatchCondition,
  TextFilter,
  TextRule,
} from '#/features/integrations/api/ruleTypes'
import { describeTemplate } from '#/features/text-templates/data/describe'
import { cleanTerms } from '#/features/text-templates/data/terms'
import { FIELD_META, FIELD_ORDER, HOP_FIELDS } from './ruleFields'
import { guessDateFormat, suggestPattern } from './tokens'
import type { Token } from '#/lib/wordTokens'

/** A rule as the editor holds it: `key` is stable across edits, before and after a save. */
export type RuleDraft = IntegrationRule & { key: string }

let drafted = 0
const nextKey = () => `draft-${(drafted += 1)}`

export const toDraft = (rule: IntegrationRule): RuleDraft => ({
  ...rule,
  key: rule.id ?? nextKey(),
})

/** What a rule reads: a JSON payload through paths, or a text message through a template. */
export type RuleKind = 'json' | 'text'

export const kindOf = (rule: IntegrationRule): RuleKind =>
  rule.text ? 'text' : 'json'

export const newTextRule = (textPath: string | null = null): TextRule => ({
  textPath,
  filter: { textAny: [], excludeAny: [] },
  template: null,
  walletId: null,
  type: 'spend',
  categoryId: null,
  defaultMerchant: '',
})

export const newRule = (count: number, kind: RuleKind = 'json'): RuleDraft => ({
  id: null,
  key: nextKey(),
  name: `Rule ${count + 1}`,
  match: null,
  fields: {},
  text: kind === 'text' ? newTextRule() : null,
})

export const isBound = (locator: Locator | undefined): boolean =>
  Boolean(locator && (locator.path?.trim() || locator.const?.trim()))

// --- What gets sent -------------------------------------------------------------------

function cleanLocator(field: LocatorField, locator: Locator): Locator {
  const constant = locator.const?.trim()
  const clean: Locator = constant
    ? { const: constant }
    : { path: locator.path?.trim() }
  if (!constant && locator.regex?.trim()) {
    clean.regex = locator.regex
    clean.group = captureGroups(locator.regex) > 0 ? 1 : 0
  }
  if (field === 'amount') {
    if (locator.unit) clean.unit = locator.unit
    if (locator.sign) clean.sign = locator.sign
  }
  if (field === 'date' && locator.format) clean.format = locator.format
  if (field === 'type' && locator.map) {
    const entries = Object.entries(locator.map).filter(([k]) => k.trim())
    if (entries.length > 0) clean.map = Object.fromEntries(entries)
  }
  return clean
}

/** How many `(…)` groups a pattern has; the first is what a field keeps, or the whole match. */
function captureGroups(pattern: string): number {
  try {
    return (new RegExp(`${pattern}|`).exec('')?.length ?? 1) - 1
  } catch {
    return 1
  }
}

/**
 * The rule as the server should see it: fields the user has not pointed anywhere yet are left
 * out rather than sent half-made, and an empty condition means "always".
 */
export function sendable(rule: RuleDraft): IntegrationRule {
  const name = rule.name.trim() || 'Untitled rule'
  if (rule.text) {
    const { filter, defaultMerchant } = rule.text
    return {
      id: rule.id,
      name,
      match: null,
      fields: {},
      text: {
        ...rule.text,
        filter: {
          textAny: cleanTerms(filter.textAny),
          excludeAny: cleanTerms(filter.excludeAny),
        },
        defaultMerchant: defaultMerchant.trim(),
      },
    }
  }
  const fields: IntegrationRule['fields'] = {}
  for (const field of FIELD_ORDER) {
    const locator = rule.fields[field]
    if (locator && isBound(locator))
      fields[field] = cleanLocator(field, locator)
  }
  const match = rule.match?.path.trim()
    ? { ...rule.match, path: rule.match.path.trim() }
    : null
  return { id: rule.id, name, match, fields, text: null }
}

export const sameRules = (a: RuleDraft[], b: RuleDraft[]): boolean =>
  JSON.stringify(a.map(sendable)) === JSON.stringify(b.map(sendable))

// --- Binding a tapped value -------------------------------------------------------------

export type Binding = {
  path: string
  value: unknown
  /** Set when one piece of a string was tapped rather than the whole value. */
  piece?: { tokens: Token[]; index: number }
}

const TX_TYPES = new Set(['spend', 'income'])

/** A field's locator after a tap: the new source, with the options the user set kept. */
export function bindLocator(
  field: LocatorField,
  current: Locator | undefined,
  binding: Binding,
): Locator {
  const next: Locator = { ...current, path: binding.path }
  delete next.const
  delete next.regex
  delete next.group
  let read = binding.value

  if (binding.piece && typeof binding.value === 'string') {
    const { tokens, index } = binding.piece
    const suggestion = suggestPattern(field, binding.value, tokens, index)
    if (suggestion) {
      next.regex = suggestion.regex
      next.group = 1
      read = binding.value.slice(suggestion.start, suggestion.end)
    }
  }

  if (field === 'date') next.format = guessDateFormat(read)
  if (field === 'type' && read !== null && typeof read !== 'object') {
    const seen = String(read)
    if (!TX_TYPES.has(seen.toLowerCase())) {
      next.map = { ...next.map, [seen]: next.map?.[seen] ?? 'SPEND' }
    }
  }
  return next
}

export function bindMatch(binding: Binding): MatchCondition {
  if (binding.piece) {
    const token = binding.piece.tokens[binding.piece.index]
    return {
      path: binding.path,
      op: 'CONTAINS',
      value: token.text,
      ignoreCase: true,
    }
  }
  const scalar =
    binding.value !== null && typeof binding.value !== 'object'
      ? String(binding.value)
      : null
  return scalar === null
    ? { path: binding.path, op: 'EXISTS', value: '', ignoreCase: false }
    : { path: binding.path, op: 'EQUALS', value: scalar, ignoreCase: true }
}

/**
 * Where the target goes after a tap: on to the next of amount → currency → date that is still
 * empty, and nowhere once they are all set. Optional fields never take the target by
 * themselves.
 */
export function nextTarget(
  fields: IntegrationRule['fields'],
  after: LocatorField,
): LocatorField | null {
  const from = HOP_FIELDS.indexOf(after)
  const order =
    from === -1
      ? HOP_FIELDS
      : [...HOP_FIELDS.slice(from + 1), ...HOP_FIELDS.slice(0, from)]
  return order.find((field) => !isBound(fields[field])) ?? null
}

export const firstTarget = (
  fields: IntegrationRule['fields'],
): LocatorField | null =>
  HOP_FIELDS.find((field) => !isBound(fields[field])) ?? null

// --- Describing a rule ------------------------------------------------------------------

type MatchSummary = {
  path: string
  relation: 'is' | 'contains' | 'is present'
  value: string | null
}

/** A condition in words; null means the rule always matches. */
export function describeMatch(
  match: MatchCondition | null,
): MatchSummary | null {
  if (!match || !match.path.trim()) return null
  if (match.op === 'EXISTS') {
    return { path: match.path, relation: 'is present', value: null }
  }
  return {
    path: match.path,
    relation: match.op === 'CONTAINS' ? 'contains' : 'is',
    value: match.value,
  }
}

const quoted = (terms: string[]) => terms.map((t) => `“${t}”`).join(' or ')

/** A text rule's filter in words, as its row reads. */
export function describeTextFilter(
  filter: TextFilter,
  textPath: string | null = null,
): string {
  const messages = textPath ? `Messages in ${textPath}` : 'Text messages'
  const parts = [
    filter.textAny.length
      ? `${messages} with ${quoted(filter.textAny)}`
      : textPath
        ? `Any message in ${textPath}`
        : 'Any text message',
  ]
  if (filter.excludeAny.length) parts.push(`not ${quoted(filter.excludeAny)}`)
  return parts.join(' · ')
}

export function describeFields(rule: IntegrationRule): string {
  if (rule.text) return describeTemplate(rule.text.template)
  const labels = FIELD_ORDER.filter((f) => isBound(rule.fields[f])).map((f) =>
    FIELD_META[f].label.toLowerCase(),
  )
  return labels.length > 0 ? labels.join(' · ') : 'Reads nothing yet'
}
