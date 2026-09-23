import type {
  DateFormat,
  LocatorField,
} from '#/features/integrations/api/ruleTypes'

/** One whitespace-separated piece of a string, with its surrounding punctuation trimmed. */
export type Token = { text: string; start: number; end: number }

const LEADING = /^[(["'«]+/u
const TRAILING = /[.,;:!?)\]}"'»]+$/u

export function tokenise(text: string): Token[] {
  const tokens: Token[] = []
  for (const match of text.matchAll(/\S+/gu)) {
    const raw = match[0]
    const leading = LEADING.exec(raw)
    const lead = leading ? leading[0].length : 0
    const trailing = TRAILING.exec(raw.slice(lead))
    const trail = trailing ? trailing[0].length : 0
    if (lead + trail >= raw.length) continue
    const start = match.index + lead
    const end = match.index + raw.length - trail
    tokens.push({ text: text.slice(start, end), start, end })
  }
  return tokens
}

// --- What a piece looks like ---------------------------------------------------------

const DIGIT = '0-9٠-٩۰-۹'
const NUMBER = new RegExp(`^[-+−]?[${DIGIT}][${DIGIT}.,٫٬]*$`, 'u')
const CODE = /^[A-Z]{3}$/
const DATE = /^[0-9]{1,4}[/.-][0-9]{1,2}(?:[/.-][0-9]{1,4})?$/
const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T\S+$/
const EPOCH = /^[0-9]{9,10}$|^[0-9]{12,13}$/
const CONNECTOR = /^\p{Ll}+$/u

const hasNativeDigits = (text: string) => /[٠-٩۰-۹]/u.test(text)

/** A capturing class for a piece, chosen by what the field expects to find there. */
type Shape = { capture: string; before?: string; after?: string }

function numberShape(text: string): Shape {
  const sign = /^[-−]/u.test(text) ? '-?' : ''
  return hasNativeDigits(text)
    ? {
        capture: `${sign}[${DIGIT}][${DIGIT}.,٫٬]*`,
      }
    : { capture: `${sign}[0-9][0-9.,]*` }
}

function dateShape(text: string): Shape {
  if (ISO.test(text)) return { capture: '[0-9]{4}-[0-9]{2}-[0-9]{2}\\S*' }
  const parts = text.split(/([/.-])/)
  const capture = parts
    .map((part, i) => {
      if (i % 2 === 1) return escapeRegex(part)
      if (part.length <= 2) return '[0-9]{1,2}'
      return `[0-9]{${part.length}}`
    })
    .join('')
  return { capture }
}

function shapeFor(field: LocatorField, text: string): Shape | null {
  switch (field) {
    case 'amount':
      return NUMBER.test(text) ? numberShape(text) : null
    case 'currency':
      return CODE.test(text)
        ? { capture: '[A-Z]{3}', before: '\\b', after: '\\b' }
        : { capture: '\\S+' }
    case 'date':
      if (ISO.test(text) || DATE.test(text)) return dateShape(text)
      return EPOCH.test(text) ? { capture: `[0-9]{${text.length}}` } : null
    case 'external_id':
    case 'type':
      return { capture: '\\S+' }
    default:
      return null
  }
}

/** Fields whose value may be several words: the capture grows over neighbouring names. */
const SPANNING: ReadonlySet<LocatorField> = new Set([
  'merchant',
  'note',
  'wallet',
  'category',
  'subcategory',
])

/**
 * The run of pieces around `index` that reads as one name — "CARREFOUR HYPER 4471" — stopping
 * at lower-case connectors ("at", "on"), dates and decimal amounts.
 */
export function nameRun(tokens: Token[], index: number): [number, number] {
  const joins = (t: Token) =>
    !CONNECTOR.test(t.text) &&
    !DATE.test(t.text) &&
    !(NUMBER.test(t.text) && /[.,]/.test(t.text))
  let first = index
  let last = index
  while (first > 0 && joins(tokens[first - 1])) first -= 1
  while (last < tokens.length - 1 && joins(tokens[last + 1])) last += 1
  return [first, last]
}

// --- The pattern ---------------------------------------------------------------------

const PATTERN_MAX = 200

const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Literal context as a pattern: exact characters, any run of spaces as `\s+`. */
const literal = (text: string): string =>
  text.split(/\s+/u).map(escapeRegex).join('\\s+')

export type Suggestion = {
  regex: string
  /** The characters the pattern captures, which may be wider than the tapped piece. */
  start: number
  end: number
}

/**
 * A pattern that captures the tapped piece of `text` — generated, so nobody has to write one
 * for the common case. Candidates run from most general (the shape alone) to most anchored
 * (the literal words either side), and the first whose first match is exactly the tapped span
 * wins. Only constructs Python's `regex` and JavaScript agree on are used. Null when nothing
 * reliable exists; the caller then binds the whole value and the user writes the pattern.
 */
export function suggestPattern(
  field: LocatorField,
  text: string,
  tokens: Token[],
  index: number,
): Suggestion | null {
  const [first, last] = SPANNING.has(field)
    ? nameRun(tokens, index)
    : [index, index]
  const start = tokens[first].start
  const end = tokens[last].end
  const span = text.slice(start, end)
  const prev: Token | undefined = first > 0 ? tokens[first - 1] : undefined
  const next: Token | undefined =
    last < tokens.length - 1 ? tokens[last + 1] : undefined
  const before = prev ? literal(text.slice(prev.start, start)) : '^'
  const after = next ? literal(text.slice(end, next.end)) : '$'

  const shape = shapeFor(field, span)
  const candidates: string[] = shape
    ? [
        wrap('', shape, ''),
        wrap(prev ? before : '', shape, ''),
        wrap('', shape, next ? after : ''),
        wrap(before, shape, after),
      ]
    : [`${before}(.+?)${after}`]

  for (const pattern of candidates) {
    if (pattern.length > PATTERN_MAX) continue
    if (capturesExactly(pattern, text, start, end)) {
      return { regex: pattern, start, end }
    }
  }
  return null
}

const wrap = (before: string, shape: Shape, after: string): string =>
  `${before}${shape.before ?? ''}(${shape.capture})${shape.after ?? ''}${after}`

function capturesExactly(
  pattern: string,
  text: string,
  start: number,
  end: number,
): boolean {
  let compiled: RegExp
  try {
    compiled = new RegExp(pattern, 'd')
  } catch {
    return false
  }
  const indices = compiled.exec(text)?.indices?.[1]
  return indices !== undefined && indices[0] === start && indices[1] === end
}

/** The date layout a value most likely uses. A day above 12 settles DMY against MDY. */
export function guessDateFormat(value: unknown): DateFormat {
  if (typeof value === 'number') return value > 1e11 ? 'EPOCH_MS' : 'EPOCH_S'
  const text = String(value).trim()
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(text)) return 'ISO'
  if (/^[0-9]{12,13}$/.test(text)) return 'EPOCH_MS'
  if (/^[0-9]{9,10}$/.test(text)) return 'EPOCH_S'
  const parts = /([0-9]{1,4})[/.-]([0-9]{1,2})/.exec(text)
  if (!parts) return 'ISO'
  if (parts[1].length === 4) return 'YMD'
  if (Number(parts[1]) > 12) return 'DMY'
  if (Number(parts[2]) > 12) return 'MDY'
  return 'DMY'
}
