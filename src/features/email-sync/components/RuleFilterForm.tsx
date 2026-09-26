import { FormRow } from '#/components/FormRow'
import type { RuleFilter } from '#/features/email-sync/api/types'
import { useConfigLimits } from '#/lib/config/appConfig'
import { TermsInput } from './TermsInput'

type Props = {
  filter: RuleFilter
  onChange: (patch: Partial<RuleFilter>) => void
  sendersError?: string
  termsError?: string
}

/**
 * Which of the inbox's emails this rule is for. The senders narrow what the inbox is asked
 * for; the words tell apart the kinds of email one sender sends — a purchase from a refund
 * from a one-time code.
 */
export function RuleFilterForm({
  filter,
  onChange,
  sendersError,
  termsError,
}: Props) {
  const limits = useConfigLimits()
  const terms = limits.emailRuleTermsMax

  return (
    <div className="flex flex-col gap-3">
      <FormRow
        id="rule-senders"
        label="From"
        error={sendersError}
        help="The exact addresses these alerts come from."
      >
        <TermsInput
          id="rule-senders"
          ltr
          terms={filter.senders}
          max={limits.emailRuleSendersMax}
          placeholder="alerts@yourbank.com"
          invalid={Boolean(sendersError)}
          onChange={(senders) => onChange({ senders })}
        />
      </FormRow>
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        <FormRow
          id="rule-subject"
          label="Subject has any of"
          help="Leave empty to take any subject."
        >
          <TermsInput
            id="rule-subject"
            terms={filter.subjectAny}
            max={terms}
            placeholder="Purchase"
            onChange={(subjectAny) => onChange({ subjectAny })}
          />
        </FormRow>
        <FormRow
          id="rule-body"
          label="Email text has any of"
          help="Leave empty to take any email."
        >
          <TermsInput
            id="rule-body"
            terms={filter.bodyAny}
            max={terms}
            placeholder="debited"
            onChange={(bodyAny) => onChange({ bodyAny })}
          />
        </FormRow>
      </div>
      <FormRow
        id="rule-exclude"
        label="Skip emails that mention"
        error={termsError}
        help="Checked in the subject and the text."
      >
        <TermsInput
          id="rule-exclude"
          terms={filter.excludeAny}
          max={terms}
          placeholder="OTP"
          onChange={(excludeAny) => onChange({ excludeAny })}
        />
      </FormRow>
    </div>
  )
}
