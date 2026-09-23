import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { RuleEditorModel } from '#/features/integrations/hooks/useRuleEditor'
import {
  OUTCOME_TEXT,
  ruleVerdicts,
} from '#/features/integrations/data/verdicts'
import { RuleList } from './RuleList'

type Props = {
  model: RuleEditorModel
  /** Why changes are not possible right now, if they are not. */
  locked: boolean
}

/** The key editor's rules pane: the ordered list, and how the sample payload fares against it. */
export function KeyRulesSection({ model, locked }: Props) {
  const { rules, dryRun } = model
  const verdicts = ruleVerdicts(dryRun.result, rules.length)
  const flagged = new Set([
    ...model.saveProblems.byRule.keys(),
    ...dryRun.problems.byRule.keys(),
  ])

  return (
    <section
      aria-labelledby="key-rules-heading"
      className="flex flex-col gap-3 rounded-xl border border-fp-border bg-fp-surface-2 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="key-rules-heading" className="text-[14.5px] font-bold">
          Rules
        </h3>
        {model.status === 'ready' ? (
          <span className="text-[12px] text-fp-text-3 tabular-nums">
            <bdi>
              {rules.length} of {model.rulesMax}
            </bdi>
          </span>
        ) : null}
      </div>
      <p className="text-[12.5px] leading-relaxed text-fp-text-2">
        Checked in order; the first that matches wins.
      </p>

      {model.status === 'loading' ? (
        <p className="text-[12.5px] text-fp-text-3">Loading rules…</p>
      ) : model.status === 'failed' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-[12.5px] text-fp-danger">
            Couldn’t load this key’s rules.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={model.reload}
            className="bg-fp-surface px-3 py-[7px] text-[12.5px] font-semibold"
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          {rules.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-fp-text-2">
              No rules yet. Anything this key receives will wait in your review
              queue until you add one.
            </p>
          ) : (
            <RuleList
              rules={rules}
              verdicts={verdicts}
              flagged={flagged}
              disabled={locked}
              onOpen={model.openRule}
              onRemove={model.remove}
              onMove={model.move}
            />
          )}
          <SampleSummary model={model} />
          {model.conflict ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-[12.5px] text-fp-danger">
                These rules were changed somewhere else. Reload them to carry on
                — your edits here will be lost.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={model.reload}
                className="bg-fp-surface px-3 py-[7px] text-[12.5px] font-semibold"
              >
                Reload rules
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={locked || !model.canAddRule}
            onClick={model.add}
            className="gap-1.5 self-start bg-fp-surface px-3.5 py-2 text-[13px] font-semibold"
          >
            <Plus size={15} strokeWidth={2.2} />
            Add rule
          </Button>
          {!model.canAddRule ? (
            <p className="text-[12px] text-fp-text-3">
              A key can have up to {model.rulesMax} rules.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

function SampleSummary({ model }: { model: RuleEditorModel }) {
  const { result } = model.dryRun
  if (!model.reading.ok || !result || model.rules.length === 0) return null
  const fired = result.matchedIndex
  const text =
    fired !== null
      ? `Your sample payload is handled by rule ${fired + 1}. ${OUTCOME_TEXT[result.would]}`
      : `No rule matches your sample payload. ${OUTCOME_TEXT[result.would]}`
  return (
    <p role="status" className="text-[12.5px] text-fp-text-2">
      {text}
    </p>
  )
}
