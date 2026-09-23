/**
 * Date reading for imported files. The format is inferred **once per column**, never per
 * cell: `03/04/2026` read as March 4th in one row and April 3rd in the next is the quietest
 * way an import can be wrong, and a whole column carries the evidence a single cell lacks.
 */

export type DateFormatToken =
  | 'YYYY-MM-DD'
  | 'ISO'
  | 'YYYY/MM/DD'
  | 'YYYY.MM.DD'
  | 'DD-MMM-YYYY'
  | 'MMM DD, YYYY'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'DD-MM-YYYY'
  | 'MM-DD-YYYY'
  | 'DD.MM.YYYY'
  | 'MM.DD.YYYY'
  | 'DD/MM/YY'
  | 'MM/DD/YY'
  | 'DD-MM-YY'
  | 'MM-DD-YY'
  | 'DD.MM.YY'
  | 'MM.DD.YY'

type FieldOrder = 'DMY' | 'MDY' | 'YMD'

type Pattern =
  | { kind: 'numeric'; order: FieldOrder; sep: string; shortYear: boolean }
  | { kind: 'monthName'; order: 'DMY' | 'MDY' }
  | { kind: 'iso' }

/** A 2-digit year below this reads as 20xx, at or above it as 19xx. */
export const YEAR_PIVOT = 70

// Ordered: the unambiguous formats come first, so a tie between survivors resolves to the
// one that cannot be read two ways.
const PATTERNS: ReadonlyArray<readonly [DateFormatToken, Pattern]> = [
  ['YYYY-MM-DD', { kind: 'numeric', order: 'YMD', sep: '-', shortYear: false }],
  ['ISO', { kind: 'iso' }],
  ['YYYY/MM/DD', { kind: 'numeric', order: 'YMD', sep: '/', shortYear: false }],
  ['YYYY.MM.DD', { kind: 'numeric', order: 'YMD', sep: '.', shortYear: false }],
  ['DD-MMM-YYYY', { kind: 'monthName', order: 'DMY' }],
  ['MMM DD, YYYY', { kind: 'monthName', order: 'MDY' }],
  ['DD/MM/YYYY', { kind: 'numeric', order: 'DMY', sep: '/', shortYear: false }],
  ['MM/DD/YYYY', { kind: 'numeric', order: 'MDY', sep: '/', shortYear: false }],
  ['DD-MM-YYYY', { kind: 'numeric', order: 'DMY', sep: '-', shortYear: false }],
  ['MM-DD-YYYY', { kind: 'numeric', order: 'MDY', sep: '-', shortYear: false }],
  ['DD.MM.YYYY', { kind: 'numeric', order: 'DMY', sep: '.', shortYear: false }],
  ['MM.DD.YYYY', { kind: 'numeric', order: 'MDY', sep: '.', shortYear: false }],
  ['DD/MM/YY', { kind: 'numeric', order: 'DMY', sep: '/', shortYear: true }],
  ['MM/DD/YY', { kind: 'numeric', order: 'MDY', sep: '/', shortYear: true }],
  ['DD-MM-YY', { kind: 'numeric', order: 'DMY', sep: '-', shortYear: true }],
  ['MM-DD-YY', { kind: 'numeric', order: 'MDY', sep: '-', shortYear: true }],
  ['DD.MM.YY', { kind: 'numeric', order: 'DMY', sep: '.', shortYear: true }],
  ['MM.DD.YY', { kind: 'numeric', order: 'MDY', sep: '.', shortYear: true }],
]

export const DATE_FORMAT_TOKENS: ReadonlyArray<DateFormatToken> = PATTERNS.map(
  ([token]) => token,
)

const PATTERN_BY_TOKEN = new Map<DateFormatToken, Pattern>(PATTERNS)

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
]

const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i

const DATE_LIKE_RE =
  /^\s*(?:\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/

const pad = (value: number, width: number): string =>
  String(value).padStart(width, '0')

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

// Arithmetic rather than a Date probe: inference tests every value of a column against
// every surviving candidate, and allocating a Date per test dominated the pass.
const toIsoDate = (year: number, month: number, day: number): string | null => {
  if (month < 1 || month > 12 || day < 1) return null
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1]
  if (day > limit) return null
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

const expandYear = (year: number, shortYear: boolean): number =>
  shortYear ? (year < YEAR_PIVOT ? 2000 + year : 1900 + year) : year

const numericRe = (pattern: {
  order: FieldOrder
  sep: string
  shortYear: boolean
}): RegExp => {
  const sep = `\\${pattern.sep}`
  if (pattern.order === 'YMD')
    return new RegExp(`^(\\d{4})${sep}(\\d{1,2})${sep}(\\d{1,2})$`)
  const year = pattern.shortYear ? '\\d{2}' : '\\d{4}'
  return new RegExp(`^(\\d{1,2})${sep}(\\d{1,2})${sep}(${year})$`)
}

const NUMERIC_RE_CACHE = new Map<string, RegExp>()

const cachedNumericRe = (pattern: {
  order: FieldOrder
  sep: string
  shortYear: boolean
}): RegExp => {
  const key = `${pattern.order}${pattern.sep}${pattern.shortYear ? 's' : 'l'}`
  const cached = NUMERIC_RE_CACHE.get(key)
  if (cached) return cached
  const built = numericRe(pattern)
  NUMERIC_RE_CACHE.set(key, built)
  return built
}

const parseNumeric = (
  value: string,
  pattern: { order: FieldOrder; sep: string; shortYear: boolean },
): string | null => {
  const match = cachedNumericRe(pattern).exec(value)
  if (!match) return null
  const [a, b, c] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (pattern.order === 'YMD') return toIsoDate(a, b, c)
  const year = expandYear(c, pattern.shortYear)
  return pattern.order === 'DMY' ? toIsoDate(year, b, a) : toIsoDate(year, a, b)
}

const monthNumber = (name: string): number =>
  MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1

const MONTH_DMY_RE = /^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})$/
const MONTH_MDY_RE = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/

const parseMonthName = (value: string, order: 'DMY' | 'MDY'): string | null => {
  const match = (order === 'DMY' ? MONTH_DMY_RE : MONTH_MDY_RE).exec(value)
  if (!match) return null
  const day = Number(order === 'DMY' ? match[1] : match[2])
  const month = monthNumber(order === 'DMY' ? match[2] : match[1])
  if (month === 0) return null
  return toIsoDate(Number(match[3]), month, day)
}

/**
 * An ISO instant is truncated to the **local** calendar date, matching how the ledger stores
 * `date`: a purchase stamped 2026-08-04T23:30:00Z belongs to the 5th for a user in Riyadh.
 */
const parseIso = (value: string): string | null => {
  // Optional groups come back undefined, which the array type does not say on its own.
  const match: Array<string | undefined> | null = ISO_RE.exec(value)
  if (!match) return null
  const [, y, m, d, hh, mm, ss, zone] = match
  // No time, or a wall-clock time with no offset: the written date is already the local one.
  if (hh === undefined || mm === undefined || zone === undefined) {
    return toIsoDate(Number(y), Number(m), Number(d))
  }
  const instant = new Date(
    `${y}-${m}-${d}T${hh}:${mm}:${ss ?? '00'}${zone.toUpperCase() === 'Z' ? 'Z' : zone}`,
  )
  if (Number.isNaN(instant.getTime())) return null
  return toIsoDate(
    instant.getFullYear(),
    instant.getMonth() + 1,
    instant.getDate(),
  )
}

/** Parse one cell under a known format token into a wire `YYYY-MM-DD`, or null. */
export const parseDateCell = (
  cell: string,
  token: DateFormatToken,
): string | null => {
  const value = cell.trim()
  if (value === '') return null
  const pattern = PATTERN_BY_TOKEN.get(token)
  if (!pattern) return null
  if (pattern.kind === 'iso') return parseIso(value)
  if (pattern.kind === 'monthName') return parseMonthName(value, pattern.order)
  return parseNumeric(value, pattern)
}

/** Cheap shape test used by header and column detection — not a parse. */
export const isDateLike = (cell: string): boolean => DATE_LIKE_RE.test(cell)

export type DateInference = {
  format: DateFormatToken | null
  /** True when DD/MM and MM/DD both survived and the locale, not the file, decided. */
  ambiguous: boolean
  candidates: ReadonlyArray<DateFormatToken>
  sampled: number
}

/** Whether the locale writes the day or the month first — read from CLDR, not a country list. */
const localeOrder = (locale: string): 'DMY' | 'MDY' | 'YMD' => {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(new Date(2026, 5, 16))
    const first = parts.find(
      (part) =>
        part.type === 'day' || part.type === 'month' || part.type === 'year',
    )
    if (first?.type === 'month') return 'MDY'
    if (first?.type === 'year') return 'YMD'
    return 'DMY'
  } catch {
    return 'DMY'
  }
}

const orderOf = (token: DateFormatToken): FieldOrder | null => {
  const pattern = PATTERN_BY_TOKEN.get(token)
  if (!pattern || pattern.kind === 'iso') return null
  return pattern.order
}

/**
 * Every value in the column is tested, not a sample: a single row proving DD/MM can sit
 * anywhere in a statement, and missing it is the silent failure this module exists to
 * prevent. It stays cheap because each value is only tested against the candidates still
 * alive, and that set collapses to one or two within a few rows.
 */
export const inferDateFormat = (
  values: ReadonlyArray<string>,
  options: { locale?: string } = {},
): DateInference => {
  let candidates: ReadonlyArray<DateFormatToken> = DATE_FORMAT_TOKENS
  let sampled = 0
  for (const raw of values) {
    const value = raw.trim()
    if (value === '') continue
    sampled += 1
    candidates = candidates.filter(
      (token) => parseDateCell(value, token) !== null,
    )
    if (candidates.length === 0) break
  }

  if (sampled === 0) {
    return { format: null, ambiguous: false, candidates: [], sampled: 0 }
  }
  if (candidates.length === 0) {
    return { format: null, ambiguous: false, candidates: [], sampled }
  }

  const dayFirst = candidates.find((token) => orderOf(token) === 'DMY')
  const monthFirst = candidates.find((token) => orderOf(token) === 'MDY')
  const ambiguous = dayFirst !== undefined && monthFirst !== undefined

  const format = ambiguous
    ? localeOrder(options.locale ?? 'en-US') === 'MDY'
      ? monthFirst
      : dayFirst
    : candidates[0]

  return { format, ambiguous, candidates, sampled }
}
