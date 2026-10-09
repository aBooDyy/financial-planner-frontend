import { FormRow } from '#/components/FormRow'
import type { TextFilter } from '#/features/integrations/api/ruleTypes'
import { TEXT_TERMS_MAX } from '#/features/integrations/data/ruleFields'
import { TermsInput } from '#/features/text-templates/components/TermsInput'

type Props = {
  filter: TextFilter
  onChange: (patch: Partial<TextFilter>) => void
  error?: string
}

/**
 * Which text messages this rule is for. One bank sends purchases, refunds and one-time codes
 * alike; the words tell them apart.
 */
export function TextFilterForm({ filter, onChange, error }: Props) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
      <FormRow
        id="rule-text-any"
        label="Message has any of"
        error={error}
        help="Leave empty to take any message."
      >
        <TermsInput
          id="rule-text-any"
          terms={filter.textAny}
          max={TEXT_TERMS_MAX}
          placeholder="Purchase"
          invalid={Boolean(error)}
          onChange={(textAny) => onChange({ textAny })}
        />
      </FormRow>
      <FormRow
        id="rule-text-exclude"
        label="Skip messages that mention"
        help="Checked anywhere in the message."
      >
        <TermsInput
          id="rule-text-exclude"
          terms={filter.excludeAny}
          max={TEXT_TERMS_MAX}
          placeholder="OTP"
          onChange={(excludeAny) => onChange({ excludeAny })}
        />
      </FormRow>
    </div>
  )
}
