import type { TextRule } from '#/features/integrations/api/ruleTypes'
import type { OpenRule } from '#/features/integrations/data/ruleEditorState'
import { templateCurrent } from '#/features/integrations/data/ruleEditorState'
import type { RuleProblem } from '#/features/integrations/data/ruleErrors'
import type { RuleEditorModel } from '#/features/integrations/hooks/useRuleEditor'
import { EditorSection } from '#/features/text-templates/components/EditorSection'
import type { Tapping } from '#/features/text-templates/data/tapping'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import type { CurrencyCode } from '#/lib/currency'
import { TextFilterForm } from './TextFilterForm'
import { TextReadingStep } from './TextReadingStep'
import { TextRoutingForm } from './TextRoutingForm'
import { TextSampleStep } from './TextSampleStep'

type Props = {
  model: RuleEditorModel
  open: OpenRule
  text: TextRule
  tapping: Tapping
  problem: RuleProblem | null
  online: boolean
  walletGroups: WalletGroupOption[]
  baseCurrency: CurrencyCode
  maxBytes: number
}

/**
 * A text rule, in the four steps an email rule takes: a sample message, how to read it, which
 * messages it is for, and where they go. Desktop: the sample stays beside the steps; phone:
 * stacked, sample first, because a tap on it fills the step below.
 */
export function TextRuleEditor({
  model,
  open,
  text,
  tapping,
  problem,
  online,
  walletGroups,
  baseCurrency,
  maxBytes,
}: Props) {
  const focus = model.dryRun.result?.focus ?? null

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex min-w-0 flex-col gap-[14px] md:sticky md:top-0 md:self-start">
        <TextSampleStep
          model={model}
          tapping={tapping}
          textPath={text.textPath}
          pathError={problem?.textPath}
          online={online}
          maxBytes={maxBytes}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-[14px]">
        <TextReadingStep
          model={model}
          tapping={tapping}
          text={text}
          current={templateCurrent(open)}
          baseCurrency={baseCurrency}
        />
        {problem?.template ? (
          <p role="alert" className="text-[12px] font-semibold text-fp-danger">
            {problem.template}
          </p>
        ) : null}

        <EditorSection step={3} title="Which messages">
          <TextFilterForm
            filter={text.filter}
            onChange={model.editTextFilter}
            error={problem?.filter}
          />
          {focus && tapping.mapping.sample ? (
            <p role="status" className="text-[12.5px] text-fp-text-2">
              {focus.matched
                ? 'Your sample message gets through.'
                : `Your sample message doesn’t: ${focus.detail ?? 'it isn’t taken'}.`}
            </p>
          ) : null}
        </EditorSection>

        <EditorSection step={4} title="File into">
          <TextRoutingForm
            text={text}
            walletGroups={walletGroups}
            onEdit={model.editText}
            problem={problem}
          />
        </EditorSection>
      </div>
    </div>
  )
}
