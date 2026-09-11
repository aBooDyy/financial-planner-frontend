/**
 * Display formatting for a specific calendar date. The order (day/month/year) is a
 * device-local user preference; the default is day-first (D/M/Y). Month/range/weekday
 * navigation labels are not "dates" in this sense and stay textual elsewhere.
 */
export type DateFormat = 'dmy' | 'mdy' | 'ymd'

export const DEFAULT_DATE_FORMAT: DateFormat = 'dmy'

// Example labels use the same sample date so the Settings picker reads as a live preview.
export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'dmy', label: '16/06/2026' },
  { value: 'mdy', label: '06/16/2026' },
  { value: 'ymd', label: '2026-06-16' },
]

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/** Parse a wire `YYYY-MM-DD` string to a local Date, or null if it isn't a full ISO date. */
export const parseISODate = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export const formatDate = (
  d: Date,
  fmt: DateFormat = DEFAULT_DATE_FORMAT,
): string => {
  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = d.getFullYear()
  switch (fmt) {
    case 'mdy':
      return `${month}/${day}/${year}`
    case 'ymd':
      return `${year}-${month}-${day}`
    default:
      return `${day}/${month}/${year}`
  }
}
