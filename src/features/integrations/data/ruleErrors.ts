import type { LocatorField } from '#/features/integrations/api/ruleTypes'
import { ApiError } from '#/lib/apiError'
import { messageForApiError, messageForCode } from '#/lib/errorMessages'

export type RuleProblem = {
  name?: string
  match?: string
  fields: Partial<Record<LocatorField, string>>
  /** Something wrong with the rule that no single control owns. */
  other?: string
}

export type RuleProblems = {
  /** By the rule's position in the set that was sent. */
  byRule: Map<number, RuleProblem>
  general: string | null
}

export const NO_PROBLEMS: RuleProblems = { byRule: new Map(), general: null }

const RULE_FIELD = /^rules\[(\d+)\](?:\.(\w+)(?:\.(\w+))?)?/

/**
 * A 422 on a rule set names each failing part as `rules[2].fields.amount.regex`; each message
 * goes beside the control it is about. Anything else — the ceiling, a conflict, the network —
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
    if (part === 'fields' && field) {
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
