import { DayOfMonthField } from './DayOfMonthField'

type Props = {
  value: string
  onChange: (value: string) => void
}

/** The day of the month planned set-asides fall on (1–28; blank = the 1st). */
export function SetAsideDayField({ value, onChange }: Props) {
  return (
    <DayOfMonthField
      id="set-aside-day"
      label="Set aside on"
      value={value}
      onChange={onChange}
      placeholder="1"
      help="Pick a day after payday · 1–28"
    />
  )
}
