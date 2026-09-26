import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'

type Props = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  help?: string
}

/** "Paid on [27] of each month": a day box read as part of a sentence. */
export function DayOfMonthField({
  id,
  label,
  value,
  onChange,
  placeholder,
  help,
}: Props) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex flex-wrap items-center gap-[10px]">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          maxLength={2}
          placeholder={placeholder}
          className="w-[72px] text-center tabular-nums"
        />
        <span className="text-[13px] font-semibold text-fp-text-2">
          of each month
        </span>
      </div>
      <FieldMessage help={help} />
    </div>
  )
}
