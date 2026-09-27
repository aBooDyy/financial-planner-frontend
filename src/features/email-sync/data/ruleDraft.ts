import type {
  EmailRule,
  EmailRuleDraft,
  ExtractionTemplate,
  RuleFilter,
} from '#/features/email-sync/api/types'
import type { TxType } from '#/features/transactions/api/types'

export const RULE_NAME_MAX = 120
export const TERM_MAX = 100

/** A rule as the editor holds it: the template stays null until one has been learned. */
export type RuleDraft = {
  /** Stable across edits and reorders — a new rule has no id yet. */
  key: string
  id: string | null
  name: string
  enabled: boolean
  filter: RuleFilter
  template: ExtractionTemplate | null
  walletId: string | null
  type: TxType
  /** A root's or a child's id; null leaves it to the review. */
  categoryId: string | null
  /** Filed as the merchant when an email names none. */
  defaultMerchant: string
  autoConfirm: boolean
}

export const RULE_DEFAULT_MERCHANT_MAX = 200

export const EMPTY_FILTER: RuleFilter = {
  senders: [],
  subjectAny: [],
  bodyAny: [],
  excludeAny: [],
}

let fresh = 0

export const newRule = (): RuleDraft => ({
  key: `new-${(fresh += 1)}`,
  id: null,
  name: '',
  enabled: true,
  filter: EMPTY_FILTER,
  template: null,
  walletId: null,
  type: 'spend',
  categoryId: null,
  defaultMerchant: '',
  autoConfirm: false,
})

export const toDraft = (rule: EmailRule): RuleDraft => ({
  key: rule.id,
  id: rule.id,
  name: rule.name,
  enabled: rule.enabled,
  filter: rule.filter,
  template: rule.template,
  walletId: rule.walletId,
  type: rule.type,
  categoryId: rule.categoryId,
  defaultMerchant: rule.defaultMerchant ?? '',
  autoConfirm: rule.autoConfirm,
})

export const fallbackName = (draft: RuleDraft): string =>
  draft.name.trim() || draft.filter.senders[0] || 'Untitled rule'

/** The draft as the wire takes it; null while it has nothing to read with. */
export function sendable(draft: RuleDraft): EmailRuleDraft | null {
  if (!draft.template) return null
  return {
    id: draft.id,
    name: fallbackName(draft).slice(0, RULE_NAME_MAX),
    enabled: draft.enabled,
    filter: draft.filter,
    template: draft.template,
    walletId: draft.walletId,
    type: draft.type,
    categoryId: draft.categoryId,
    defaultMerchant:
      draft.defaultMerchant.trim().slice(0, RULE_DEFAULT_MERCHANT_MAX) || null,
    autoConfirm: draft.autoConfirm && draft.walletId !== null,
  }
}

const shape = (rules: RuleDraft[]): string =>
  JSON.stringify(rules.map(({ key: _key, ...rest }) => rest))

export const sameRules = (a: RuleDraft[], b: RuleDraft[]): boolean =>
  a === b || shape(a) === shape(b)

/** Terms typed into a list: trimmed, capped, empties and repeats dropped. */
export function cleanTerms(terms: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of terms) {
    const term = raw.trim().slice(0, TERM_MAX)
    const folded = term.toLowerCase()
    if (!term || seen.has(folded)) continue
    seen.add(folded)
    out.push(term)
  }
  return out
}

const quoted = (terms: string[]) => terms.map((t) => `“${t}”`).join(' or ')

/** The filter in words, as a rule row's second line reads. */
export function describeFilter(filter: RuleFilter): string {
  const parts: string[] = []
  const [first, ...more] = filter.senders
  if (first)
    parts.push(more.length ? `From ${first} +${more.length}` : `From ${first}`)
  else parts.push('No sender yet')
  if (filter.subjectAny.length)
    parts.push(`subject has ${quoted(filter.subjectAny)}`)
  if (filter.bodyAny.length) parts.push(`body has ${quoted(filter.bodyAny)}`)
  if (filter.excludeAny.length) parts.push(`not ${quoted(filter.excludeAny)}`)
  return parts.join(' · ')
}

/** What the template reads, in words: "Reads amount, currency, merchant". */
export function describeTemplate(template: ExtractionTemplate | null): string {
  if (!template) return 'Nothing to read yet'
  const parts = ['amount']
  parts.push(
    template.currency.mode === 'fixed'
      ? `always ${template.currency.code}`
      : 'currency',
  )
  if (template.merchant) parts.push('merchant')
  return `Reads ${parts.join(', ')}`
}

export type DraftProblems = Partial<
  Record<'name' | 'senders' | 'template' | 'autoConfirm', string>
>

/** What stops the open rule from joining the set, checked before the server sees it. */
export function draftProblems(draft: RuleDraft): DraftProblems {
  const problems: DraftProblems = {}
  if (draft.name.length > RULE_NAME_MAX)
    problems.name = `Keep the name to ${RULE_NAME_MAX} characters.`
  if (draft.filter.senders.length === 0)
    problems.senders = 'Add the address these emails come from.'
  if (!draft.template)
    problems.template = 'Pick a sample email and tap what to read.'
  if (draft.autoConfirm && draft.walletId === null)
    problems.autoConfirm = 'Choose an account first.'
  return problems
}
