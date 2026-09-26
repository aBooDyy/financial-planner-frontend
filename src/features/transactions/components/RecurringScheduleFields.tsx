import { Chip, ChipRow } from '#/components/dialog/Chip'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FREQUENCIES } from '#/features/goals/constants'
import type { GoalFrequency } from '#/features/goals/api/types'
import type { DateFormat } from '#/lib/date'
import { TxSection } from './TxSection'

type Props = {
  frequency: GoalFrequency
  date: string
  autopost: boolean
  /** The chosen frequency's colour. */
  tint: string
  dateFormat: DateFormat
  onFrequency: (f: GoalFrequency) => void
  onDate: (iso: string) => void
  onAutopost: (on: boolean) => void
}

const FREQUENCY_KEYS = Object.keys(FREQUENCIES) as GoalFrequency[]

/** When a recurring entry comes round: how often, the next due date, and whether it posts itself. */
export function RecurringScheduleFields({
  frequency,
  date,
  autopost,
  tint,
  dateFormat,
  onFrequency,
  onDate,
  onAutopost,
}: Props) {
  return (
    <>
      <TxSection label="Repeats">
        <ChipRow label="Frequency">
          {FREQUENCY_KEYS.map((f) => (
            <Chip
              key={f}
              active={frequency === f}
              color={tint}
              size="sm"
              onClick={() => onFrequency(f)}
            >
              {FREQUENCIES[f].label}
            </Chip>
          ))}
        </ChipRow>
      </TxSection>

      <div>
        <FieldLabel>Next due date</FieldLabel>
        <DateField
          value={date}
          onChange={onDate}
          dateFormat={dateFormat}
          ariaLabel="Next due date"
          hint
        />
      </div>

      <ToggleCard
        title="Auto-post on due date"
        description="Log it automatically each cycle"
        checked={autopost}
        onCheckedChange={onAutopost}
      />
    </>
  )
}
