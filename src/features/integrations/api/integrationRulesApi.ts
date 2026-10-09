import {
  toLearned,
  toLearnOptionsWire,
  toPicksWire,
} from '#/features/text-templates/api/types'
import type {
  Learned,
  LearnedWire,
  LearnRequest,
} from '#/features/text-templates/api/types'
import { http } from '#/lib/http'
import type {
  DryRun,
  DryRunRequestWire,
  DryRunWire,
  IntegrationRule,
  RuleSet,
  RuleSetWire,
  RuleWire,
} from './ruleTypes'
import { toDryRun, toRuleSet, toRuleWire } from './ruleTypes'

const keyPath = (keyId: string) =>
  `/integration-keys/${encodeURIComponent(keyId)}`

/**
 * A key's rules are one document: read whole, replaced whole, guarded by one version. They are
 * only ever needed inside the editor, so they are fetched on open and never cached.
 */
export const integrationRulesApi = {
  list: (keyId: string): Promise<RuleSet> =>
    http.get<RuleSetWire>(`${keyPath(keyId)}/rules`).then(toRuleSet),

  replace: (
    keyId: string,
    version: string,
    rules: IntegrationRule[],
  ): Promise<RuleSet> =>
    http
      .put<RuleSetWire>(`${keyPath(keyId)}/rules`, {
        version,
        rules: rules.map(toRuleWire),
      })
      .then(toRuleSet),

  /** Writes nothing. `rules` tries unsaved rules instead of the saved ones. */
  dryRun: (
    keyId: string,
    payload: string,
    rules?: RuleWire[],
    focusIndex?: number,
  ): Promise<DryRun> => {
    const body: DryRunRequestWire = { payload }
    if (rules) body.rules = rules
    if (focusIndex !== undefined) body.focus_index = focusIndex
    return http.post<DryRunWire>(`${keyPath(keyId)}/test`, body).then(toDryRun)
  },

  /** A text rule's template from taps on a sample message. Writes nothing. */
  learn: (keyId: string, request: LearnRequest): Promise<Learned> =>
    http
      .post<LearnedWire>(`${keyPath(keyId)}/rules/learn`, {
        sample: request.sample.bodyLines.join('\n'),
        picks: toPicksWire(request.picks),
        options: toLearnOptionsWire(request.options),
      })
      .then(toLearned),
}
