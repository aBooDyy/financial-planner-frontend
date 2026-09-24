import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { FIELD_LABEL } from './styles'

type Props = {
  value: string
  onChange: (value: string) => void
}

/** The day of the month planned set-asides fall on (1–28; blank = the 1st). */
export function SetAsideDayField({ value, onChange }: Props) {
  return (
    <div>
      <Label className={FIELD_LABEL} htmlFor="set-aside-day">
        Set aside on (day of month)
      </Label>
      <div className="flex items-center gap-3">
        <Input
          id="set-aside-day"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          maxLength={2}
          placeholder="1"
          className="w-[96px] text-center tabular-nums"
        />
        <span className="text-[12px] text-fp-text-3">
          Pick a day after payday · 1–28
        </span>
      </div>
    </div>
  )
}
