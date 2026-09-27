import type { BodyFormat } from '#/features/inbound-imports/api/types'
import { currencyTokens, numberTokens, readNumber } from '#/lib/lineTokens'
import type { LineToken } from '#/lib/lineTokens'
import { nameRun, tokenise } from '#/lib/wordTokens'
import type { Token } from '#/lib/wordTokens'

/** The values a review reads out of the body, in the order a person fills them. */
export type ReadField = 'amount' | 'currency' | 'merchant'

export const READ_FIELDS: ReadonlyArray<{ field: ReadField; label: string }> = [
  { field: 'amount', label: 'Amount' },
  { field: 'currency', label: 'Currency' },
  { field: 'merchant', label: 'Merchant' },
]

export type ReadValues = Record<ReadField, string>

export type ReadSpan = { start: number; end: number; field: ReadField }

export type TokenShape = 'number' | 'currency' | 'word'

export type Segment =
  | { kind: 'plain'; text: string }
  | { kind: 'token'; text: string; index: number; shape: TokenShape }
  | { kind: 'read'; text: string; field: ReadField }

type Hit = { line: number; token: LineToken }

const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-9

type Range = { start: number; end: number }

const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end

/**
 * A JSON payload is shown pretty-printed, so each value sits on a line of its own; anything
 * that does not parse — a cut-off payload, a text body — is shown as stored.
 */
export function displayLines(
  format: BodyFormat,
  lines: string[],
  truncated: boolean,
): string[] {
  if (format !== 'json' || truncated) return lines
  try {
    return JSON.stringify(JSON.parse(lines.join('\n')), null, 2).split('\n')
  } catch {
    return lines
  }
}

function findAmount(lines: string[], values: ReadValues): Hit | null {
  const target = readNumber(values.amount.trim(), 'auto')
  if (target === null) return null
  const hits: Hit[] = []
  lines.forEach((text, line) => {
    for (const token of numberTokens(text)) {
      const value = readNumber(token.text, 'auto')
      if (value !== null && sameNumber(value, target))
        hits.push({ line, token })
    }
  })
  const code = values.currency
  return (
    hits.find((h) =>
      currencyTokens(lines[h.line]).some((c) => c.text === code),
    ) ??
    hits.at(0) ??
    null
  )
}

function findCurrency(
  lines: string[],
  code: string,
  near: number | null,
): Hit | null {
  if (!code) return null
  const hits: Hit[] = []
  lines.forEach((text, line) => {
    for (const token of currencyTokens(text))
      if (token.text === code) hits.push({ line, token })
  })
  return hits.find((h) => h.line === near) ?? hits.at(0) ?? null
}

function findMerchant(lines: string[], merchant: string): Hit | null {
  const needle = merchant.trim().toLowerCase()
  if (!needle) return null
  for (let line = 0; line < lines.length; line += 1) {
    const start = lines[line].toLowerCase().indexOf(needle)
    if (start !== -1) {
      const end = start + needle.length
      return {
        line,
        token: { start, end, text: lines[line].slice(start, end) },
      }
    }
  }
  return null
}

/**
 * Where each value the review holds is written in the body, by line. The amount is matched by
 * its number (preferring a line that also names the currency), the currency by its code (on
 * the amount's line when it is there), the merchant by its text; a merchant covering the
 * others' place wins it.
 */
export function locateReads(
  lines: string[],
  values: ReadValues,
): Map<number, ReadSpan[]> {
  const amount = findAmount(lines, values)
  const currency = findCurrency(lines, values.currency, amount?.line ?? null)
  const merchant = findMerchant(lines, values.merchant)
  const found: [ReadField, Hit | null][] = [
    ['merchant', merchant],
    ['amount', amount],
    ['currency', currency],
  ]
  const byLine = new Map<number, ReadSpan[]>()
  for (const [field, hit] of found) {
    if (!hit) continue
    const spans = byLine.get(hit.line) ?? []
    if (spans.some((s) => overlaps(s, hit.token))) continue
    spans.push({ start: hit.token.start, end: hit.token.end, field })
    byLine.set(hit.line, spans)
  }
  return byLine
}

function shapeOf(token: Token, codes: LineToken[]): TokenShape {
  if (codes.some((c) => c.start === token.start && c.end === token.end))
    return 'currency'
  return /\d/u.test(token.text) && readNumber(token.text, 'auto') !== null
    ? 'number'
    : 'word'
}

/**
 * One line cut into what the review draws: plain text, the tokens a tap can use, and the
 * spans already read (which swallow the tokens under them).
 */
export function lineSegments(
  line: string,
  reads: ReadSpan[],
): { segments: Segment[]; tokens: Token[] } {
  const tokens = tokenise(line)
  const codes = currencyTokens(line)
  const spans = [...reads].sort((a, b) => a.start - b.start)
  const segments: Segment[] = []
  let at = 0
  let next = 0

  const plainTo = (end: number) => {
    if (end > at) segments.push({ kind: 'plain', text: line.slice(at, end) })
    at = Math.max(at, end)
  }
  const readsBefore = (limit: number) => {
    while (next < spans.length && spans[next].start < limit) {
      const span = spans[next]
      next += 1
      if (span.start < at) continue
      plainTo(span.start)
      segments.push({
        kind: 'read',
        text: line.slice(span.start, span.end),
        field: span.field,
      })
      at = span.end
    }
  }

  tokens.forEach((token, index) => {
    readsBefore(token.end)
    if (token.start < at) return
    plainTo(token.start)
    segments.push({
      kind: 'token',
      text: token.text,
      index,
      shape: shapeOf(token, codes),
    })
    at = token.end
  })
  readsBefore(Infinity)
  plainTo(line.length)
  return { segments, tokens }
}

/** What a tap on a token means for `field`: a merchant grows over the name around it. */
export function tappedText(
  line: string,
  tokens: Token[],
  index: number,
  field: ReadField,
): string {
  if (field !== 'merchant') return tokens[index].text
  const [first, last] = nameRun(tokens, index)
  return line.slice(tokens[first].start, tokens[last].end)
}

/**
 * The field a tap on a token fills: a code is a currency and a number an amount, whatever is
 * picked; words only name a merchant, so they answer a tap only while the merchant is picked.
 */
export function fieldForTap(
  shape: TokenShape,
  picked: ReadField,
): ReadField | null {
  if (shape === 'currency') return 'currency'
  if (picked === 'merchant') return 'merchant'
  return shape === 'number' ? 'amount' : null
}

/** "STARBUCKS RIYADH" reads as "Starbucks Riyadh"; anything already cased is kept. */
export function displayName(text: string): string {
  const trimmed = text.trim()
  if (!/\p{Lu}/u.test(trimmed) || trimmed !== trimmed.toUpperCase())
    return trimmed
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s\-/&])(\p{L})/gu, (_, sep: string, ch: string) => {
      return sep + ch.toUpperCase()
    })
}

/** The field a tap fills when the user has not picked one: the first still empty. */
export const firstEmpty = (values: ReadValues): ReadField =>
  READ_FIELDS.find(({ field }) => !values[field].trim())?.field ?? 'amount'
