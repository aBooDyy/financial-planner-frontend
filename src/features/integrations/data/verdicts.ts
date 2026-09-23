import type {
  DryRun,
  DryRunOutcome,
} from '#/features/integrations/api/ruleTypes'

/** How the sample fared at one rule: it fired, it was checked and passed over, or never reached. */
export type RuleVerdict = 'fires' | 'skipped' | 'unreached'

export function ruleVerdicts(run: DryRun | null, count: number): RuleVerdict[] {
  const verdicts: RuleVerdict[] = Array.from(
    { length: count },
    () => 'unreached',
  )
  if (!run) return verdicts
  for (const entry of run.trace) {
    if (entry.index < count)
      verdicts[entry.index] = entry.matched ? 'fires' : 'skipped'
  }
  return verdicts
}

export const OUTCOME_TEXT: Record<DryRunOutcome, string> = {
  STAGE: 'It would wait in your review queue.',
  POST: 'It would go straight into your ledger.',
  IGNORE:
    'Nothing would be kept — the key is set to drop payloads it can’t read.',
}
