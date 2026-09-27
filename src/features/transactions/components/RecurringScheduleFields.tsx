import { Chip, ChipRow } from '#/components/dialog/Chip'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FREQUENCIES } from '#/features/goals/constants'
import type { GoalFrequency } from '#/features/goals/api/types'
import type { DateFormat } from '#/lib/date'
import { RecurringEndField } from './RecurringEndField'
import { TxSection } from './TxSection'

type Props = {
  frequency: GoalFrequency
  date: string
  endsOn: string | null
  /** Marks the end date as falling before the next due date. */
  endInvalid: boolean
  autopost: boolean
  /** The chosen frequency's colour. */
  tint: string
  dateFormat: DateFormat
  onFrequency: (f: GoalFrequency) => void
  onDate: (iso: string) => void
  onEndsOn: (endsOn: string | null) => void
  onAutopost: (on: boolean) => void
}

const FREQUENCY_KEYS = Object.keys(FREQUENCIES) as GoalFrequency[]

/** When a recurring entry comes round: how often, the next due date, when it stops, and whether it posts itself. */
export function RecurringScheduleFields({
  frequency,
  date,
  endsOn,
  endInvalid,
  autopost,
  tint,
  dateFormat,
  onFrequency,
  onDate,
  onEndsOn,
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

      <RecurringEndField
        endsOn={endsOn}
        nextDue={date}
        tint={tint}
        dateFormat={dateFormat}
        invalid={endInvalid}
        onChange={onEndsOn}
      />

      <ToggleCard
        title="Auto-post on due date"
        description="Log it automatically each cycle"
        checked={autopost}
        onCheckedChange={onAutopost}
      />
    </>
  )
}
