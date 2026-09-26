import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { IntervalUnit } from '#/features/goals/api/types'
import { CUSTOM_INTERVAL_MAX } from '#/features/goals/constants'
import {
  customFrequencyMeta,
  isValidInterval,
} from '#/features/goals/data/cadence'

type Props = {
  interval: string
  unit: IntervalUnit
  onInterval: (value: string) => void
  onUnit: (unit: IntervalUnit) => void
}

const UNITS: ReadonlyArray<{ value: IntervalUnit; one: string; many: string }> =
  [
    { value: 'day', one: 'day', many: 'days' },
    { value: 'week', one: 'week', many: 'weeks' },
    { value: 'month', one: 'month', many: 'months' },
  ]

function rhythmOf(every: number, unit: IntervalUnit): string {
  const perYear = customFrequencyMeta(every, unit).perYear
  if (Math.abs(perYear - 1) < 0.05) return 'About once a year'
  if (perYear > 1) return `About ${Math.round(perYear)} times a year`
  const years = Math.round((1 / perYear) * 10) / 10
  return `About once every ${years} years`
}

/** "Every [28] [days]": a custom repeat read as one sentence. */
export function CustomIntervalField({
  interval,
  unit,
  onInterval,
  onUnit,
}: Props) {
  const every = Number(interval)
  const valid = isValidInterval(every)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-[10px]">
        <span className="text-[13px] font-semibold text-fp-text-2">Every</span>
        <Input
          id="custom-interval"
          aria-label="Repeat every"
          value={interval}
          onChange={(e) => onInterval(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          maxLength={3}
          placeholder="28"
          aria-invalid={!valid}
          className="w-[72px] text-center tabular-nums"
        />
        <Select value={unit} onValueChange={(v) => onUnit(v as IntervalUnit)}>
          <SelectTrigger aria-label="Unit" className="w-[132px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {every === 1 ? u.one : u.many}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FieldMessage
        error={valid ? null : `Enter a number from 1 to ${CUSTOM_INTERVAL_MAX}`}
        help={
          valid ? `${rhythmOf(every, unit)}, from the next due date` : undefined
        }
      />
    </div>
  )
}
