/** Backfill windows offered next to Sync now, trimmed to the server's lookback ceiling. */
const WINDOW_DAYS = [7, 30, 90, 180]

export const windowOptions = (maxLookbackDays: number): number[] =>
  WINDOW_DAYS.filter((days) => days <= maxLookbackDays)

export const windowLabel = (days: number): string => `Last ${days} days`
