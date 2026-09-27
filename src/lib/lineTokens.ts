import { getAppConfig } from '#/lib/config/appConfig'

/** Which mark a number's decimal point is: guessed, `1,234.56` or `1.234,56`. */
export type DecimalStyle = 'auto' | 'dot' | 'comma'

/** A value written on a line, and where it sits there. */
export type LineToken = { start: number; end: number; text: string }

// Arabic-Indic and Extended Arabic-Indic digits, plus the Arabic decimal and thousands marks,
// mapped one-for-one so positions in the translated text are positions in the line.
const NATIVE = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫٬'
const ASCII = '01234567890123456789.,'
const GROUPING = /[ \u00a0\u2009\u202f']/g
// The server's own number shape: digits grouped in threes with an optional decimal tail, or a
// plain run with one. Keeping it identical keeps a tapped number's index the server's index.
const NUMBER =
  /[0-9]{1,3}(?:[ \u00a0\u2009\u202f'.,][0-9]{3})+(?:[.,][0-9]+)?|[0-9]+(?:[.,][0-9]+)?/g

const toAscii = (text: string): string =>
  [...text]
    .map((ch) => {
      const at = NATIVE.indexOf(ch)
      return at === -1 ? ch : ASCII[at]
    })
    .join('')

/** Every number written on the line, with where it sits. */
export function numberTokens(line: string): LineToken[] {
  const ascii = toAscii(line)
  return [...ascii.matchAll(NUMBER)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    text: line.slice(m.index, m.index + m[0].length),
  }))
}

const autoNormalise = (token: string): string => {
  const commas = token.split(',').length - 1
  const dots = token.split('.').length - 1
  if (commas && dots) {
    const decimal = token.lastIndexOf(',') > token.lastIndexOf('.') ? ',' : '.'
    const grouping = decimal === ',' ? '.' : ','
    return token.split(grouping).join('').replace(decimal, '.')
  }
  if (commas > 1 || dots > 1) return token.replace(/[.,]/g, '')
  if (commas === 1) {
    const [whole, fraction] = token.split(',')
    const groupsThousands = fraction.length === 3 && whole !== '0'
    return token.replace(',', groupsThousands ? '' : '.')
  }
  return token
}

/** How `raw` reads under a decimal style — the same rules the server applies. */
export function readNumber(raw: string, style: DecimalStyle): number | null {
  const token = toAscii(raw).replace(GROUPING, '')
  if (!/^[0-9][0-9.,]*$/.test(token)) return null
  const normalised =
    style === 'dot'
      ? token.replace(/,/g, '')
      : style === 'comma'
        ? token.replace(/\./g, '').replace(',', '.')
        : autoNormalise(token)
  if ((normalised.match(/\./g) ?? []).length > 1) return null
  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

let cached: { version: string; pattern: RegExp } | null = null

/**
 * Any known currency code as a whole word. Case-sensitive on purpose: alerts write the code in
 * caps, and matching case-insensitively across the full ISO table would catch ordinary words
 * (TRY, ALL, CUP).
 */
export const currencyPattern = (): RegExp => {
  const { version, currencies } = getAppConfig()
  if (!cached || cached.version !== version) {
    const codes = currencies.map((c) => c.code).join('|')
    cached = { version, pattern: new RegExp(`\\b(${codes})\\b`, 'g') }
  }
  return cached.pattern
}

/** Every known currency code written on the line. */
export function currencyTokens(line: string): LineToken[] {
  return [...line.matchAll(currencyPattern())].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    text: m[0],
  }))
}
