const DIGIT = '0-9٠-٩۰-۹'
const NUMBER = new RegExp(`^[-+−]?[${DIGIT}][${DIGIT}.,٫٬]*$`, 'u')
const DATE = /^[0-9]{1,4}[/.-][0-9]{1,2}(?:[/.-][0-9]{1,4})?$/
const CONNECTOR = /^\p{Ll}+$/u
const LEADING = /^[(["'«]+/u
const TRAILING = /[.,;:!?)\]}"'»]+$/u

/** One whitespace-separated piece of a string, with its surrounding punctuation trimmed. */
export type Token = { text: string; start: number; end: number }

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
