import type { ChangeEvent } from 'react'
import { asciiDigits } from '#/lib/digits'

/** `decimals` caps the fraction (0 = whole numbers, omitted = no cap). */
export type NumericRules = { decimals?: number; signed?: boolean }

const ARABIC_DECIMAL = /٫/g

/**
 * Coerce typed or pasted text into a plain number string: Arabic digits and the Arabic decimal
 * mark become ASCII, anything that isn't a digit is dropped, only the first point survives and
 * the fraction stops at `decimals`. A minus survives only as the first character of a signed field.
 */
export const sanitizeNumeric = (
  raw: string,
  { decimals = Infinity, signed = false }: NumericRules,
): string => {
  let out = ''
  let fractionDigits: number | null = null
  for (const ch of asciiDigits(raw).replace(ARABIC_DECIMAL, '.')) {
    if (ch >= '0' && ch <= '9') {
      if (fractionDigits === null) out += ch
      else if (fractionDigits < decimals) {
        fractionDigits++
        out += ch
      }
    } else if (ch === '.' && decimals > 0 && fractionDigits === null) {
      fractionDigits = 0
      out += ch
    } else if (ch === '-' && signed && out === '') {
      out += ch
    }
  }
  return out
}

/** "-1234567.5" → "-1,234,567.5": commas between thousands of the whole part only. */
export const groupThousands = (clean: string): string => {
  const dot = clean.indexOf('.')
  const whole = dot === -1 ? clean : clean.slice(0, dot)
  const grouped = whole.replace(/\B(?=(\d{3})+$)/g, ',')
  return dot === -1 ? grouped : grouped + clean.slice(dot)
}

// Where the caret belongs in `shown` so that `significant` non-separator characters precede it.
const caretIn = (shown: string, significant: number): number => {
  let seen = 0
  for (let i = 0; i < shown.length; i++) {
    if (seen === significant) return i
    if (shown[i] !== ',') seen++
  }
  return shown.length
}

/**
 * Props that make an input numeric-only: the phone's number keypad, and an onChange that hands
 * `onValue` the sanitized text so a rejected character never shows up. `display` is how the
 * field renders that text, so the caret can be kept beside the same digit.
 */
export const numericInputProps = (
  rules: NumericRules,
  onValue: (value: string) => void,
  display: (clean: string) => string = (clean) => clean,
): {
  inputMode: 'numeric' | 'decimal'
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
} => ({
  inputMode: rules.decimals === 0 ? 'numeric' : 'decimal',
  onChange: (e) => {
    const input = e.currentTarget
    const raw = input.value
    const clean = sanitizeNumeric(raw, rules)
    onValue(clean)
    const shown = display(clean)
    if (shown === raw) return
    // React writes the cleaned value back after this handler, which throws the caret to the end.
    const caret = caretIn(
      shown,
      sanitizeNumeric(raw.slice(0, input.selectionStart ?? raw.length), rules)
        .length,
    )
    requestAnimationFrame(() => {
      if (document.activeElement === input)
        input.setSelectionRange(caret, caret)
    })
  },
})
