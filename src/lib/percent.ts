/**
 * Format a share already expressed in percent (0–100). Anything that rounds away to
 * nothing still reads as present rather than as zero.
 */
export const formatShare = (pct: number, locale = 'en-US'): string => {
  if (pct > 0 && pct < 1) return '<1%'
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(pct / 100)
}
