/**
 * ISO `YYYY-MM-DD` helpers for planned rows. Every date here is a local calendar date, so
 * ordering is plain string comparison and arithmetic goes through a local-midnight `Date`.
 */

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

export const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const dateOf = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const addDaysISO = (iso: string, days: number): string => {
  const d = dateOf(iso)
  return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export const daysBetween = (a: string, b: string): number =>
  Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86_400_000)

/** `iso` moved by whole calendar months, its day clamped to the target month's length. */
export const addMonthsISO = (iso: string, months: number): string => {
  const d = dateOf(iso)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate()
  return isoOf(
    new Date(
      target.getFullYear(),
      target.getMonth(),
      Math.min(d.getDate(), last),
    ),
  )
}
