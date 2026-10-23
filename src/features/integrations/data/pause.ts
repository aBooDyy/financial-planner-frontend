import { formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'

/** How long a key can be paused for; `day` reveals a picker for the day it resumes. */
export type PausePreset = '1h' | '1d' | '7d' | 'day'

export const PAUSE_PRESETS: ReadonlyArray<{
  value: PausePreset
  label: string
}> = [
  { value: '1h', label: '1 hour' },
  { value: '1d', label: '1 day' },
  { value: '7d', label: '1 week' },
  { value: 'day', label: 'Until a day…' },
]

const HOUR_MS = 3600 * 1000

const PRESET_MS: Record<Exclude<PausePreset, 'day'>, number> = {
  '1h': HOUR_MS,
  '1d': 24 * HOUR_MS,
  '7d': 7 * 24 * HOUR_MS,
}

export const presetPause = (
  preset: Exclude<PausePreset, 'day'>,
  now: Date = new Date(),
): string => new Date(now.getTime() + PRESET_MS[preset]).toISOString()

/** A key paused "until Monday" works again from the very start of Monday, local time. */
export const startOfDayIso = (isoDay: string): string => {
  const [y, m, d] = isoDay.split('-').map(Number)
  return new Date(y, m - 1, d).toISOString()
}

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** "3:40 PM" today, else "25/10/2026, 3:40 PM" — a pause can be an hour or a month. */
export const formatResume = (
  iso: string,
  locale: string,
  dateFormat: DateFormat,
  now: Date = new Date(),
): string => {
  const at = new Date(iso)
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(at)
  return sameDay(at, now) ? time : `${formatDate(at, dateFormat)}, ${time}`
}
