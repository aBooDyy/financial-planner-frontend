import { Check } from 'lucide-react'
import type { TextRule } from '#/features/integrations/api/ruleTypes'
import type { RuleEditorModel } from '#/features/integrations/hooks/useRuleEditor'
import { EditorSection } from '#/features/text-templates/components/EditorSection'
import { NumberChoice } from '#/features/text-templates/components/NumberChoice'
import { ReadingOptions } from '#/features/text-templates/components/ReadingOptions'
import { ReadingSummary } from '#/features/text-templates/components/ReadingSummary'
import { describeTemplate } from '#/features/text-templates/data/describe'
import type { Tapping } from '#/features/text-templates/data/tapping'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  model: RuleEditorModel
  tapping: Tapping
  text: TextRule
  current: boolean
  baseCurrency: CurrencyCode
}

/** Step 2 of a text rule: which number is the amount, how it is written, and what it reads. */
export function TextReadingStep({
  model,
  tapping,
  text,
  current,
  baseCurrency,
}: Props) {
  const { sample, picks, options } = tapping.mapping
  const learnedNow = current && text.template !== null
  const amountPick = picks.amount
  const amountLine =
    sample && amountPick ? (sample.bodyLines[amountPick.line] ?? null) : null
  const rawAmount =
    amountLine &&
    amountPick?.start !== undefined &&
    amountPick.end !== undefined
      ? amountLine.slice(amountPick.start, amountPick.end)
      : (model.learned?.reading.fields.amount.raw ?? null)

  return (
    <EditorSection
      step={2}
      title="How to read it"
      done={learnedNow}
      aside={
        learnedNow ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-fp-accent-soft px-2 py-0.5 text-[11px] font-extrabold tracking-[0.02em] text-fp-accent-ink">
            <Check size={11} strokeWidth={3} />
            Learned
          </span>
        ) : null
      }
    >
      {!sample ? (
        <p className="text-[12.5px] leading-[1.5] text-fp-text-2">
          {text.template
            ? `${describeTemplate(text.template)}. Paste a sample message to change it.`
            : 'Paste a sample message first.'}
        </p>
      ) : (
        <>
          {amountLine !== null && amountPick ? (
            <NumberChoice
              line={amountLine}
              pick={amountPick}
              onChoose={(pick) =>
                model.tap({ type: 'setPick', field: 'amount', pick })
              }
            />
          ) : null}
          <ReadingOptions
            noun="message"
            options={options}
            rawAmount={rawAmount}
            detectedCurrency={model.learned?.reading.currency ?? null}
            baseCurrency={baseCurrency}
            onDecimal={(style) => model.tap({ type: 'decimal', style })}
            onCurrency={(mode, code) =>
              model.tap({ type: 'currency', mode, code })
            }
          />
          <ReadingSummary
            noun="message"
            reading={model.learned?.reading ?? null}
            defaultMerchant={text.defaultMerchant.trim() || null}
            pending={model.learning.pending}
            error={model.learnError}
          />
        </>
      )}
    </EditorSection>
  )
}
