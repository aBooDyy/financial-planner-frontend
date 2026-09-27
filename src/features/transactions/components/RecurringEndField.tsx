import { Chip, ChipRow } from '#/components/dialog/Chip'
import { DateField } from '#/components/DateField'
import { defaultEndDate } from '#/features/transactions/data/scheduleEditor'
import type { DateFormat } from '#/lib/date'
import { TxSection } from './TxSection'

type Props = {
  /** Null repeats forever. */
  endsOn: string | null
  nextDue: string
  tint: string
  dateFormat: DateFormat
  invalid?: boolean
  onChange: (endsOn: string | null) => void
}

/** When a recurring entry stops: never, or after a chosen date. */
export function RecurringEndField({
  endsOn,
  nextDue,
  tint,
  dateFormat,
  invalid = false,
  onChange,
}: Props) {
  const onDate = endsOn !== null
  return (
    <TxSection label="Ends">
      <ChipRow label="Ends">
        <Chip
          active={!onDate}
          color={tint}
          size="sm"
          onClick={() => onChange(null)}
        >
          Never
        </Chip>
        <Chip
          active={onDate}
          color={tint}
          size="sm"
          onClick={() => onDate || onChange(defaultEndDate(nextDue))}
        >
          On a date
        </Chip>
      </ChipRow>
      {onDate ? (
        <div className="mt-2">
          <DateField
            value={endsOn}
            onChange={onChange}
            dateFormat={dateFormat}
            ariaLabel="End date"
            invalid={invalid}
            hint
          />
        </div>
      ) : null}
    </TxSection>
  )
}
