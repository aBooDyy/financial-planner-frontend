import { Chip, ChipRow } from '#/components/dialog/Chip'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { CustomIntervalField } from '#/features/goals/components/CustomIntervalField'
import { FREQUENCIES, FREQUENCY_OPTIONS } from '#/features/goals/constants'
import type { GoalFrequency, IntervalUnit } from '#/features/goals/api/types'
import type { RepeatDraft } from '#/features/goals/data/cadence'
import type { DateFormat } from '#/lib/date'
import { RecurringEndField } from './RecurringEndField'
import { TxSection } from './TxSection'

type Props = {
  repeat: RepeatDraft
  date: string
  endsOn: string | null
  /** Marks the end date as falling before the next due date. */
  endInvalid: boolean
  autopost: boolean
  /** The chosen frequency's colour. */
  tint: string
  dateFormat: DateFormat
  onFrequency: (f: GoalFrequency) => void
  onCustom: () => void
  onCustomInterval: (value: string) => void
  onCustomUnit: (unit: IntervalUnit) => void
  onDate: (iso: string) => void
  onEndsOn: (endsOn: string | null) => void
  onAutopost: (on: boolean) => void
}

/** When a recurring entry comes round: how often (a preset or every N days / weeks / months), the next due date, when it stops, and whether it posts itself. */
export function RecurringScheduleFields({
  repeat,
  date,
  endsOn,
  endInvalid,
  autopost,
  tint,
  dateFormat,
  onFrequency,
  onCustom,
  onCustomInterval,
  onCustomUnit,
  onDate,
  onEndsOn,
  onAutopost,
}: Props) {
  return (
    <>
      <TxSection label="Repeats">
        <ChipRow label="Frequency">
          {FREQUENCY_OPTIONS.map((f) => (
            <Chip
              key={f}
              active={!repeat.customRepeat && repeat.frequency === f}
              color={tint}
              size="sm"
              onClick={() => onFrequency(f)}
            >
              {FREQUENCIES[f].label}
            </Chip>
          ))}
          <Chip
            active={repeat.customRepeat}
            color={tint}
            size="sm"
            onClick={onCustom}
          >
            Custom
          </Chip>
        </ChipRow>
        {repeat.customRepeat ? (
          <div className="mt-3">
            <CustomIntervalField
              interval={repeat.customInterval}
              unit={repeat.customUnit}
              onInterval={onCustomInterval}
              onUnit={onCustomUnit}
            />
          </div>
        ) : null}
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
