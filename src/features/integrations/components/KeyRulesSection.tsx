import { useState } from 'react'
import { CheckCircle2, Info, ListFilter, Plus } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { NoteBox } from '#/components/dialog/NoteBox'
import { EmptyState } from '#/components/EmptyState'
import { Button } from '#/components/ui/button'
import type { RuleEditorModel } from '#/features/integrations/hooks/useRuleEditor'
import {
  OUTCOME_TEXT,
  ruleVerdicts,
} from '#/features/integrations/data/verdicts'
import { SMALL_BUTTON, SOFT_BUTTON } from './buttonStyles'
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
  const [removing, setRemoving] = useState<number | null>(null)

  return (
    <section
      aria-labelledby="key-rules-heading"
      className="flex flex-col gap-[10px]"
    >
      <div>
        <div className="flex items-center gap-2">
          <h3
            id="key-rules-heading"
            className="flex-1 text-[15px] font-extrabold"
          >
            Rules
          </h3>
          {model.status === 'ready' ? (
            <span className="text-[12.5px] font-semibold text-fp-text-3 tabular-nums">
              <bdi>
                {rules.length} of {model.rulesMax}
              </bdi>
            </span>
          ) : null}
        </div>
        <p className="mt-[3px] text-[12.5px] leading-[1.45] text-fp-text-2">
          Checked in order; the first that matches wins.
        </p>
      </div>

      {model.status === 'loading' ? (
        <p className="text-[12.5px] text-fp-text-3">Loading rules…</p>
      ) : model.status === 'failed' ? (
        <NoteBox tone="danger">
          <div className="flex flex-wrap items-center gap-3">
            <span role="alert" className="flex-1">
              Couldn’t load this key’s rules.
            </span>
            <Button
              type="button"
              variant="quiet"
              onClick={model.reload}
              className={SMALL_BUTTON}
            >
              Try again
            </Button>
          </div>
        </NoteBox>
      ) : (
        <>
          {rules.length === 0 ? (
            <EmptyState
              icon={ListFilter}
              size="sm"
              framed
              title="No rules yet"
              text="Anything this key receives will wait in your review queue until you add one."
            />
          ) : (
            <RuleList
              rules={rules}
              verdicts={verdicts}
              flagged={flagged}
              disabled={locked}
              onOpen={model.openRule}
              onRemove={setRemoving}
              onMove={model.move}
            />
          )}
          <SampleSummary model={model} />
          {model.conflict ? (
            <NoteBox tone="danger">
              <div className="flex flex-col items-start gap-2">
                <span role="alert">
                  These rules were changed somewhere else. Reload them to carry
                  on — your edits here will be lost.
                </span>
                <Button
                  type="button"
                  variant="quiet"
                  onClick={model.reload}
                  className={SMALL_BUTTON}
                >
                  Reload rules
                </Button>
              </div>
            </NoteBox>
          ) : null}
          <div>
            <Button
              type="button"
              variant="ghost"
              disabled={locked || !model.canAddRule}
              onClick={model.add}
              className={`${SMALL_BUTTON} ${SOFT_BUTTON} gap-1`}
            >
              <Plus size={15} strokeWidth={2.4} />
              Add rule
            </Button>
          </div>
          {!model.canAddRule ? (
            <p className="text-[12px] text-fp-text-3">
              A key can have up to {model.rulesMax} rules.
            </p>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title={`Delete “${removing !== null ? (rules[removing]?.name ?? '') : ''}”?`}
        bullets={[
          'The rules after it move up one place.',
          'Nothing changes until you save the key.',
        ]}
        confirmLabel="Delete"
        onConfirm={() => {
          if (removing !== null) model.remove(removing)
          setRemoving(null)
        }}
      />
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
    <NoteBox
      tone={fired !== null ? 'accent' : 'neutral'}
      icon={fired !== null ? <CheckCircle2 /> : <Info />}
    >
      <span role="status">{text}</span>
    </NoteBox>
  )
}
