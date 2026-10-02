/**
 * Date helpers for goals and income. Dates on the wire are ISO `YYYY-MM-DD` strings; these
 * convert at the edge; `startOfToday` is where callers read the clock.
 */

/** Today at local midnight — the single reference point the engine plans from. */
export const startOfToday = (): Date => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/** Parse an ISO `YYYY-MM-DD` string to a local Date (defaults fill missing parts). */
export const parseISO = (s: string | null, fallback: Date): Date => {
  if (!s) return fallback
  const parts = s.split('-')
  const y = Number(parts[0]) || fallback.getFullYear()
  const m = (Number(parts[1]) || 1) - 1
  const d = parts[2] ? Number(parts[2]) : 1
  return new Date(y, m, d)
}

/** A Date → ISO `YYYY-MM-DD`. */
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
