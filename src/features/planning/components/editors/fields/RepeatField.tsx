import { Chip, ChipRow } from '#/components/dialog/Chip'
import { FieldLabel } from '#/components/FieldLabel'
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
import {
  REPEAT_ERROR,
  REPEAT_LABEL,
  repeatValid,
} from '#/features/planning/view/repeat'
import type { RepeatDraft, RepeatPick } from '#/features/planning/view/repeat'

const UNITS: ReadonlyArray<{ value: IntervalUnit; one: string; many: string }> =
  [
    { value: 'day', one: 'day', many: 'days' },
    { value: 'week', one: 'week', many: 'weeks' },
    { value: 'month', one: 'month', many: 'months' },
  ]

type Props = {
  label: string
  picks: ReadonlyArray<RepeatPick>
  value: RepeatDraft
  onChange: (value: RepeatDraft) => void
}

/** "Repeats": one chip per preset, and Custom's "Every [28] [days]". */
export function RepeatField({ label, picks, value, onChange }: Props) {
  const every = Number(value.every)
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <ChipRow label={label}>
        {picks.map((pick) => (
          <Chip
            key={pick}
            size="sm"
            active={value.pick === pick}
            onClick={() => onChange({ ...value, pick })}
          >
            {REPEAT_LABEL[pick]}
          </Chip>
        ))}
      </ChipRow>
      {value.pick === 'custom' ? (
        <div className="mt-[10px]">
          <div className="flex flex-wrap items-center gap-[10px]">
            <span className="text-[13px] font-semibold text-fp-text-2">
              Every
            </span>
            <Input
              aria-label="Repeat every"
              value={value.every}
              onChange={(e) =>
                onChange({ ...value, every: e.target.value.replace(/\D/g, '') })
              }
              inputMode="numeric"
              maxLength={3}
              placeholder="28"
              aria-invalid={!repeatValid(value)}
              className="w-[72px] text-center tabular-nums"
            />
            <Select
              value={value.unit}
              onValueChange={(unit) =>
                onChange({ ...value, unit: unit as IntervalUnit })
              }
            >
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
          <FieldMessage error={repeatValid(value) ? null : REPEAT_ERROR} />
        </div>
      ) : null}
    </div>
  )
}
