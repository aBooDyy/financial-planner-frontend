import { Chip, ChipRow } from '#/components/dialog/Chip'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import {
  DEFAULT_ENDS_COUNT,
  ENDS_COUNT_ERROR,
  endsCountValid,
} from '#/features/planning/view/billDraft'
import type { BillForm, EndsPick } from '#/features/planning/view/billDraft'
import type { DateFormat } from '#/lib/date'

type Props = {
  form: BillForm
  /** "Last one on …" under "After N times". */
  lastOne: string | null
  dateFormat: DateFormat
  onPick: (ends: EndsPick) => void
  onCount: (count: string) => void
  onDate: (iso: string) => void
}

/** A repeating bill's "Ends": Never · After N times · On a date. */
export function BillEndsField({
  form,
  lastOne,
  dateFormat,
  onPick,
  onCount,
  onDate,
}: Props) {
  const countValid = endsCountValid(form)
  const count = countValid ? Number(form.endsCount) : DEFAULT_ENDS_COUNT
  return (
    <div>
      <FieldLabel>Ends</FieldLabel>
      <ChipRow label="Ends">
        <Chip
          size="sm"
          active={form.ends === 'never'}
          onClick={() => onPick('never')}
        >
          Never
        </Chip>
        <Chip
          size="sm"
          active={form.ends === 'count'}
          onClick={() => onPick('count')}
        >
          After {count} {count === 1 ? 'time' : 'times'}
        </Chip>
        <Chip
          size="sm"
          active={form.ends === 'date'}
          onClick={() => onPick('date')}
        >
          On a date
        </Chip>
      </ChipRow>
      {form.ends === 'count' ? (
        <div className="mt-[10px]">
          <div className="flex flex-wrap items-center gap-[10px]">
            <span className="text-[13px] font-semibold text-fp-text-2">
              After
            </span>
            <Input
              aria-label="How many times"
              value={form.endsCount}
              onChange={(e) => onCount(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              maxLength={3}
              placeholder={String(DEFAULT_ENDS_COUNT)}
              aria-invalid={!countValid}
              className="w-[72px] text-center tabular-nums"
            />
            <span className="text-[13px] font-semibold text-fp-text-2">
              {count === 1 ? 'time' : 'times'}
            </span>
          </div>
          <FieldMessage
            error={countValid ? null : ENDS_COUNT_ERROR}
            help={lastOne}
          />
        </div>
      ) : null}
      {form.ends === 'date' ? (
        <DateField
          className="mt-[10px]"
          value={form.endsOn}
          onChange={onDate}
          dateFormat={dateFormat}
          ariaLabel="Ends on"
        />
      ) : null}
    </div>
  )
}
