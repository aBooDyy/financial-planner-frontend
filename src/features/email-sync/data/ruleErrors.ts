import { ApiError } from '#/lib/apiError'
import { messageForApiError, messageForCode } from '#/lib/errorMessages'

/** The controls of a rule a server refusal can point at. */
export type RuleControl =
  | 'name'
  | 'senders'
  | 'terms'
  | 'template'
  | 'walletId'
  | 'category'
  | 'autoConfirm'
  | 'other'

export type RuleProblem = Partial<Record<RuleControl, string>>

export type RuleProblems = {
  /** By the rule's position in the set that was sent. */
  byRule: Map<number, RuleProblem>
  general: string | null
}

export const NO_PROBLEMS: RuleProblems = { byRule: new Map(), general: null }

const RULE_FIELD = /^rules\[(\d+)\](?:\.(.+))?$/

const controlOf = (path: string | undefined): RuleControl => {
  if (!path) return 'other'
  if (path === 'name') return 'name'
  if (path === 'filter.senders' || path.startsWith('filter.senders['))
    return 'senders'
  if (path.startsWith('filter')) return 'terms'
  if (path.startsWith('template')) return 'template'
  if (path === 'wallet_id') return 'walletId'
  if (path === 'category' || path === 'subcategory') return 'category'
  if (path === 'auto_confirm') return 'autoConfirm'
  return 'other'
}

/**
 * A 422 on a rule set names each failing part as `rules[2].filter.subject_any`; each message
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
    const problem = byRule.get(index) ?? {}
    problem[controlOf(parsed[2])] ??= messageForCode(detail.code)
    byRule.set(index, problem)
  }
  return {
    byRule,
    general: byRule.size > 0 ? null : messageForApiError(error),
  }
}
