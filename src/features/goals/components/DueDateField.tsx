import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import type { GoalKind } from '#/features/goals/api/types'
import { daysUntil, startOfToday } from '#/features/goals/data/planning'
import { usePreferencesStore } from '#/stores/preferences'

type Props = {
  kind: GoalKind
  value: string
  onChange: (iso: string) => void
}

/** A goal's target date or a bill's next due date, with how far away it is. */
export function DueDateField({ kind, value, onChange }: Props) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const isTarget = kind === 'onetime'
  const label = isTarget ? 'By when?' : 'Next due date'
  const isPast = !!value && daysUntil(value, startOfToday()) < 0

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <DateField
        value={value}
        onChange={onChange}
        dateFormat={dateFormat}
        invalid={isPast}
        hint={isPast ? 'past due' : true}
        ariaLabel={isTarget ? 'Target date' : 'Next due date'}
      />
      <FieldMessage
        error={
          isPast
            ? isTarget
              ? 'Target date is in the past'
              : 'Next due date is in the past'
            : null
        }
      />
    </div>
  )
}
