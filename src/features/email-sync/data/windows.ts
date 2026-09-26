import { parseISODate } from '#/lib/date'

/** Backfill windows offered next to Sync now, trimmed to the server's lookback ceiling. */
const WINDOW_DAYS = [7, 30, 90, 180]

const DAY_MS = 24 * 60 * 60 * 1000

export const windowOptions = (maxLookbackDays: number): number[] =>
  WINDOW_DAYS.filter((days) => days <= maxLookbackDays)

export const windowLabel = (days: number): string => `Last ${days} days`

/**
 * The lookback that reaches the start of `sinceIso`, or null when that date is unreadable, in
 * the future, or further back than the server lets a scan go. The extra day covers the whole
 * of the picked date whatever the time of the scan; mail already read is skipped anyway.
 */
export const lookbackSince = (
  sinceIso: string,
  today: Date,
  maxLookbackDays: number,
): number | null => {
  const since = parseISODate(sinceIso)
  if (since === null) return null
  // Rounded, so a daylight-saving shift between the two dates doesn't lose a day.
  const days = Math.round((today.getTime() - since.getTime()) / DAY_MS) + 1
  return days >= 1 && days <= maxLookbackDays ? days : null
}
