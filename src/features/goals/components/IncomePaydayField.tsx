import { DateField } from '#/components/DateField'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { FREQUENCIES } from '#/features/goals/constants'
import { nextPaydayOf, usesPaydayAnchor } from '#/features/goals/data/paydays'
import { shownNextPayday } from '#/features/goals/hooks/useGoalEditor'
import type { EditorDraft } from '#/features/goals/hooks/useGoalEditor'
import { formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import { FIELD_LABEL } from './styles'

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
        <Label className={FIELD_LABEL}>Next payday</Label>
        <DateField
          value={shownNextPayday(draft, today)}
          onChange={(iso) => {
            if (iso) onNextPayday(iso)
          }}
          dateFormat={dateFormat}
          ariaLabel="Next payday"
        />
        <div className="mt-1.5 text-[12px] text-fp-text-3">
          Then {FREQUENCIES[draft.frequency].every} from this date
        </div>
      </div>
    )
  }

  const day = Math.max(1, Math.min(31, parseInt(draft.day, 10) || 1))
  return (
    <div>
      <Label className={FIELD_LABEL}>Paid on (day of month)</Label>
      <div className="flex items-center gap-3">
        <Input
          value={draft.day}
          onChange={(e) => onDay(e.target.value)}
          inputMode="numeric"
          placeholder="27"
          className="w-[96px] text-center tabular-nums"
        />
        <span className="text-[12px] text-fp-text-3">
          Next:{' '}
          {formatDate(
            nextPaydayOf({ day, frequency: 'monthly' }, today),
            dateFormat,
          )}
        </span>
      </div>
    </div>
  )
}
