import type { LocatorField } from '#/features/integrations/api/ruleTypes'
import { ApiError } from '#/lib/apiError'
import { messageForApiError, messageForCode } from '#/lib/errorMessages'

export type RuleProblem = {
  name?: string
  match?: string
  fields: Partial<Record<LocatorField, string>>
  /** A text rule's parts. */
  textPath?: string
  filter?: string
  template?: string
  walletId?: string
  categoryId?: string
  defaultMerchant?: string
  /** Something wrong with the rule that no single control owns. */
  other?: string
}

type TextPart =
  | 'textPath'
  | 'filter'
  | 'template'
  | 'walletId'
  | 'categoryId'
  | 'defaultMerchant'

const TEXT_PART: Record<string, TextPart | undefined> = {
  text_path: 'textPath',
  filter: 'filter',
  template: 'template',
  wallet_id: 'walletId',
  category_id: 'categoryId',
  default_merchant: 'defaultMerchant',
}

export type RuleProblems = {
  /** By the rule's position in the set that was sent. */
  byRule: Map<number, RuleProblem>
  general: string | null
}

export const NO_PROBLEMS: RuleProblems = { byRule: new Map(), general: null }

const RULE_FIELD = /^rules\[(\d+)\](?:\.(\w+)(?:\.(\w+))?)?/

/**
 * A 422 on a rule set names each failing part as `rules[2].fields.amount.regex` (a text rule's
 * as `rules[2].filter.text_any`); each message goes beside the control it is about. Anything else — the ceiling, a conflict, the network —
 * is one line for the whole set.
 */
export function ruleProblems(error: unknown): RuleProblems {
  const byRule = new Map<number, RuleProblem>()
  const details = error instanceof ApiError ? error.details : []
  for (const detail of details) {
    const parsed = RULE_FIELD.exec(detail.field)
    if (!parsed) continue
    const index = Number(parsed[1])
    const problem = byRule.get(index) ?? { fields: {} }
    const message = messageForCode(detail.code)
    const [, , part, field] = parsed
    const textPart = part ? TEXT_PART[part] : undefined
    if (textPart) {
      problem[textPart] ??= message
    } else if (part === 'fields' && field) {
      problem.fields[field as LocatorField] ??= message
    } else if (part === 'name') {
      problem.name ??= message
    } else if (part === 'match') {
      problem.match ??= message
    } else {
      problem.other ??= message
    }
    byRule.set(index, problem)
  }
  return {
    byRule,
    general: byRule.size > 0 ? null : messageForApiError(error),
  }
}

/** The fields a failed dry run could not use, so it can be retried without them. */
export function failingFields(
  problems: RuleProblems,
): Array<{ index: number; field: LocatorField }> {
  const failing: Array<{ index: number; field: LocatorField }> = []
  for (const [index, problem] of problems.byRule) {
    for (const field of Object.keys(problem.fields) as LocatorField[]) {
      failing.push({ index, field })
    }
  }
  return failing
}
