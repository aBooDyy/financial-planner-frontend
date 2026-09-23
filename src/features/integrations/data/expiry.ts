/** The expiry choices a key offers; `date` reveals a picker for any day. */
export type ExpiryPreset = 'never' | '30d' | '90d' | '365d' | 'date'

export const EXPIRY_PRESETS: ReadonlyArray<{
  value: ExpiryPreset
  label: string
}> = [
  { value: 'never', label: 'Never' },
  { value: '30d', label: 'In 30 days' },
  { value: '90d', label: 'In 90 days' },
  { value: '365d', label: 'In a year' },
  { value: 'date', label: 'On a date…' },
]

const PRESET_DAYS: Record<'30d' | '90d' | '365d', number> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** A local calendar day as `YYYY-MM-DD`. */
const toIsoDay = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * A key expires at the **end** of the chosen local day, so "expires 31 Dec" still works all
 * of 31 Dec wherever the user is.
 */
export const endOfDayIso = (isoDay: string): string => {
  const [y, m, d] = isoDay.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59).toISOString()
}

export const presetExpiry = (
  preset: Exclude<ExpiryPreset, 'never' | 'date'>,
  now: Date = new Date(),
): string => {
  const day = new Date(now)
  day.setDate(day.getDate() + PRESET_DAYS[preset])
  return endOfDayIso(toIsoDay(day))
}

/** The local day an expiry timestamp falls on — what the date picker shows. */
export const expiryDay = (expiresAt: string | null): string =>
  expiresAt === null ? '' : toIsoDay(new Date(expiresAt))
