import { useEffect, useMemo, useRef } from 'react'
import { Input } from '#/components/ui/input'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { IntegrationKey } from '#/features/integrations/api/types'
import { referenceCandidates } from '#/features/integrations/data/payloadTree'
import { isBound } from '#/features/integrations/data/ruleDraft'
import { FIELD_META } from '#/features/integrations/data/ruleFields'
import { treeMarks } from '#/features/integrations/data/treeMarks'
import { useFieldStatusContext } from '#/features/integrations/hooks/useFieldStatusContext'
import type { RuleEditorModel } from '#/features/integrations/hooks/useRuleEditor'
import type { ConstantChoices } from './ConstantInput'
import { FieldList } from './FieldList'
import { FormRow } from '#/components/FormRow'
import { MatchConditionRow } from './MatchConditionRow'
import { ReferenceWarning } from './ReferenceWarning'
import { SamplePayloadPane } from './SamplePayloadPane'
import { TraceBanner } from './TraceBanner'

type Props = {
  model: RuleEditorModel
  apiKey: IntegrationKey
  online: boolean
  walletNames: ReadonlyMap<string, string>
  catalog: CategoryCatalog
  choices: ConstantChoices
  maxBytes: number
}

/**
 * One rule: the condition that selects it, the sample it is built from, and its fields. The
 * sample sits above the fields on a phone, because a tap fills the field below it.
 */
export function RuleEditor({
  model,
  apiKey,
  online,
  walletNames,
  catalog,
  choices,
  maxBytes,
}: Props) {
  const open = model.open
  const draft = open?.draft
  const root = useRef<HTMLDivElement>(null)
  // The dialog body is reused from the key view, so it would keep that view's scroll offset —
  // deep in the delivery log when the rule was opened from there.
  useEffect(() => {
    root.current?.scrollIntoView({ block: 'start' })
  }, [])
  const problem =
    open !== null
      ? (model.dryRun.problems.byRule.get(open.index) ??
        model.saveProblems.byRule.get(open.index) ??
        null)
      : null
  const extraction = model.dryRun.result?.focus?.result ?? null
  const statusContext = useFieldStatusContext(
    apiKey,
    walletNames,
    catalog,
    extraction,
    model.reading.ok,
  )

  const marks = useMemo(
    () => (draft ? treeMarks(draft, model.tree) : new Map<string, string[]>()),
    [draft, model.tree],
  )

  const candidates = useMemo(
    () => (model.tree ? referenceCandidates(model.tree) : []),
    [model.tree],
  )
  const highlighted = useMemo(
    () => new Set(model.highlightReference ? candidates : []),
    [model.highlightReference, candidates],
  )

  if (!open || !draft) return null
  const target = model.target
  const targetLabel =
    target === 'match'
      ? 'the condition'
      : target
        ? FIELD_META[target].label
        : null
  const ruleNames = [
    ...model.rules.map((r) => r.name),
    ...(open.isNew ? [draft.name] : []),
  ]

  return (
    <div ref={root} className="flex scroll-mt-4 flex-col gap-[14px]">
      <FormRow id="rule-name" label="Rule name" error={problem?.name}>
        <Input
          id="rule-name"
          value={draft.name}
          maxLength={120}
          onChange={(e) => model.rename(e.target.value)}
        />
      </FormRow>

      <MatchConditionRow
        match={draft.match}
        picking={target === 'match'}
        problem={problem?.match ?? null}
        onChange={model.setMatch}
        onPick={(on) => model.setTarget(on ? 'match' : null)}
      />

      <TraceBanner
        dryRun={model.dryRun}
        index={open.index}
        ruleNames={ruleNames}
        hasSample={model.reading.ok}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 md:sticky md:top-0 md:self-start">
          <SamplePayloadPane
            sample={model.sample}
            reading={model.reading}
            tree={model.tree}
            maxBytes={maxBytes}
            online={online}
            lastPayload={model.lastPayload}
            onSample={model.setSample}
            onLoadLast={() => void model.loadLastPayload()}
            onBind={model.bind}
            marks={marks}
            highlighted={highlighted}
            targetLabel={targetLabel}
          />
          {!isBound(draft.fields.external_id) ? (
            <ReferenceWarning
              onFix={model.fixReference}
              noCandidates={
                model.highlightReference &&
                model.tree !== null &&
                candidates.length === 0
              }
            />
          ) : null}
        </div>
        <FieldList
          fields={draft.fields}
          target={target}
          statusContext={statusContext}
          problem={problem}
          choices={choices}
          onChange={model.setLocator}
          onTarget={model.setTarget}
        />
      </div>
      {problem?.other ? (
        <p role="alert" className="text-[12px] font-semibold text-fp-danger">
          {problem.other}
        </p>
      ) : null}
    </div>
  )
}
