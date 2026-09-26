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

/** Largest-first, so the first unit a gap clears is the one it is spoken in. */
const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/**
 * How long ago something happened, in words — "3 days ago", "last month". For facts whose
 * *recency* is the point (a template's last use, an import, a scan). A calendar date that
 * a person might look up or compare is still `formatDate`.
 *
 * `Intl.RelativeTimeFormat` carries the locale's own wording and word order, so this works
 * in Arabic without a second string table. Returns null for an unreadable timestamp.
 */
export const formatRelativeTime = (
  iso: string,
  locale = 'en-US',
  now: Date = new Date(),
): string | null => {
  const then = new Date(iso)
  const at = then.getTime()
  if (Number.isNaN(at)) return null

  const seconds = Math.round((at - now.getTime()) / 1000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of RELATIVE_UNITS) {
    const value = Math.trunc(seconds / size)
    if (value !== 0) return format.format(value, unit)
  }
  return format.format(0, 'second')
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

const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * The short distance shown inside a date well — "today", "in 5d", "12 days ago",
 * "in 12 mos" — or null for an unreadable date.
 */
export const relativeDayLabel = (
  iso: string,
  today: Date = new Date(),
): string | null => {
  const d = parseISODate(iso)
  if (!d) return null
  const days = Math.round(
    (d.getTime() - startOfDay(today).getTime()) / 86_400_000,
  )
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${-days} days ago`
  if (days < 45) return `in ${days}d`
  const months = Math.round(days / 30.44)
  if (months < 24) return `in ${months} mos`
  return `in ${Math.round(days / 365.25)}y`
}
