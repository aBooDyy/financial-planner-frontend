import { useEffect, useRef, useState } from 'react'
import { integrationRulesApi } from '#/features/integrations/api/integrationRulesApi'
import { toRuleWire } from '#/features/integrations/api/ruleTypes'
import type {
  DryRun,
  IntegrationRule,
} from '#/features/integrations/api/ruleTypes'
import {
  NO_PROBLEMS,
  failingFields,
  ruleProblems,
} from '#/features/integrations/data/ruleErrors'
import type { RuleProblems } from '#/features/integrations/data/ruleErrors'
import { ApiError } from '#/lib/apiError'

export const DRY_RUN_DEBOUNCE_MS = 250

type DryRunRequest = {
  keyId: string
  /** Null when there is no usable sample — nothing to run. */
  payload: string | null
  rules: IntegrationRule[]
  focusIndex: number | null
}

export type DryRunState = {
  result: DryRun | null
  pending: boolean
  /** Parts of the draft the server refused; the run is retried without them. */
  problems: RuleProblems
  error: string | null
}

const IDLE: DryRunState = {
  result: null,
  pending: false,
  problems: NO_PROBLEMS,
  error: null,
}

const withoutFailing = (
  rules: IntegrationRule[],
  problems: RuleProblems,
): IntegrationRule[] => {
  const failing = failingFields(problems)
  return rules.map((rule, index) => {
    const fields = { ...rule.fields }
    for (const f of failing) if (f.index === index) delete fields[f.field]
    return { ...rule, fields }
  })
}

async function run(request: DryRunRequest & { payload: string }) {
  const send = (rules: IntegrationRule[]) =>
    integrationRulesApi.dryRun(
      request.keyId,
      request.payload,
      rules.map(toRuleWire),
      request.focusIndex ?? undefined,
    )
  try {
    return { result: await send(request.rules), problems: NO_PROBLEMS }
  } catch (error) {
    const problems = ruleProblems(error)
    const retryable =
      error instanceof ApiError &&
      error.status === 422 &&
      failingFields(problems).length > 0
    if (!retryable) throw error
    return {
      result: await send(withoutFailing(request.rules, problems)),
      problems,
    }
  }
}

/**
 * The editor's feedback loop: every edit re-runs the draft against the sample, once per burst
 * of typing. A pattern the server refuses is reported beside its field and the rest of the
 * rule still runs, so one bad regex never blanks every other field's line. The last answer
 * stays on screen while the next one is on its way — except when the rule being edited changes,
 * because another rule's answer would be wrong.
 */
export function useDryRun(
  request: DryRunRequest,
  enabled: boolean,
): DryRunState {
  const [state, setState] = useState<DryRunState>(IDLE)
  const latest = useRef(0)
  const focus = useRef<number | null>(request.focusIndex)
  const signature = JSON.stringify(request)

  useEffect(() => {
    const current = JSON.parse(signature) as DryRunRequest
    const ticket = (latest.current += 1)
    const focusMoved = focus.current !== current.focusIndex
    focus.current = current.focusIndex

    if (!enabled || current.payload === null) {
      setState(IDLE)
      return
    }
    const payload = current.payload
    setState((s) => ({ ...(focusMoved ? IDLE : s), pending: true }))

    const timer = setTimeout(() => {
      run({ ...current, payload }).then(
        ({ result, problems }) => {
          if (ticket !== latest.current) return
          setState({ result, problems, pending: false, error: null })
        },
        (error: unknown) => {
          if (ticket !== latest.current) return
          const problems = ruleProblems(error)
          setState({
            result: null,
            problems,
            pending: false,
            error: problems.general,
          })
        },
      )
    }, DRY_RUN_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [signature, enabled])

  return state
}
