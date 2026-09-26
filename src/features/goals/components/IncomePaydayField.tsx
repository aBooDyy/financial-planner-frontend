import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { FREQUENCIES } from '#/features/goals/constants'
import { nextPaydayOf, usesPaydayAnchor } from '#/features/goals/data/paydays'
import { shownNextPayday } from '#/features/goals/hooks/useGoalEditor'
import type { EditorDraft } from '#/features/goals/hooks/useGoalEditor'
import { formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import { DayOfMonthField } from './DayOfMonthField'

type Props = {
  draft: EditorDraft
  today: Date
  dateFormat: DateFormat
  onDay: (day: string) => void
  onNextPayday: (iso: string) => void
}

/**
 * When the income is paid: a day of the month for a monthly stream, otherwise the next
 * payday — every later one repeats from it, so a quarterly bonus lands in its own months.
 */
export function IncomePaydayField({
  draft,
  today,
  dateFormat,
  onDay,
  onNextPayday,
}: Props) {
  if (usesPaydayAnchor(draft.frequency)) {
    return (
      <div>
        <FieldLabel>Next payday</FieldLabel>
        <DateField
          value={shownNextPayday(draft, today)}
          onChange={(iso) => {
            if (iso) onNextPayday(iso)
          }}
          dateFormat={dateFormat}
          ariaLabel="Next payday"
          hint
        />
        <FieldMessage
          help={`Then ${FREQUENCIES[draft.frequency].every} from this date`}
        />
      </div>
    )
  }

  const day = Math.max(1, Math.min(31, parseInt(draft.day, 10) || 1))
  const next = formatDate(
    nextPaydayOf({ day, frequency: 'monthly' }, today),
    dateFormat,
  )
  return (
    <DayOfMonthField
      id="income-pay-day"
      label="Paid on"
      value={draft.day}
      onChange={onDay}
      placeholder="27"
      help={`Next: ${next}`}
    />
  )
}
