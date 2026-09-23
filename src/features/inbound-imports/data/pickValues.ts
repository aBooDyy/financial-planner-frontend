import type { CurrencyCode } from '#/lib/currency'
import { isSupportedCurrency, minorToInputValue } from '#/lib/currency'
import { readLineValues } from './lineValues'

/** The review-form fields a tapped payload value can fill. */
export type PickField = 'amount' | 'currency' | 'date' | 'merchant' | 'note'

export const PICK_FIELDS: ReadonlyArray<{
  field: PickField
  label: string
  /** How the field is named in "doesn't read as …". */
  noun: string
}> = [
  { field: 'amount', label: 'Amount', noun: 'an amount' },
  { field: 'currency', label: 'Currency', noun: 'a currency code' },
  { field: 'date', label: 'Date', noun: 'a date' },
  { field: 'merchant', label: 'Merchant', noun: 'a merchant' },
  { field: 'note', label: 'Note', noun: 'a note' },
]

const entryOf = (field: PickField) =>
  PICK_FIELDS.find((f) => f.field === field) ?? PICK_FIELDS[0]

export const pickLabel = (field: PickField): string => entryOf(field).label

/** Why a tapped value filled nothing. */
export const unreadablePick = (field: PickField, text: string): string =>
  text.trim()
    ? `“${text.trim()}” doesn’t read as ${entryOf(field).noun}.`
    : `That value is empty.`

/**
 * One tapped value. `value` is what the payload holds there (a number stays a number);
 * `text` is the part the user meant — the whole value, or the word(s) tapped inside it.
 */
export type PayloadPick = { value: unknown; text: string }

type PickedValues = {
  amount?: string
  currency?: CurrencyCode
  date?: string
  merchant?: string
  note?: string
}

const TEXT_MAX = 200

const pad = (n: number) => String(n).padStart(2, '0')

const validYmd = (y: number, m: number, d: number): string | null => {
  const at = new Date(Date.UTC(y, m - 1, d))
  return at.getUTCFullYear() === y &&
    at.getUTCMonth() === m - 1 &&
    at.getUTCDate() === d
    ? `${y}-${pad(m)}-${pad(d)}`
    : null
}

const fromEpoch = (n: number): string | null => {
  const ms = n > 1e11 ? n : n * 1000
  const at = new Date(ms)
  return Number.isNaN(at.getTime()) ? null : at.toISOString().slice(0, 10)
}

/**
 * A payload value as a `YYYY-MM-DD` day: ISO strings, epoch seconds or milliseconds, and
 * day-first numeric dates — month-first only when the day-first reading is impossible.
 */
export function readDateValue(value: unknown): string | null {
  if (typeof value === 'number') {
    return value >= 1e9 ? fromEpoch(value) : null
  }
  const text = String(value ?? '').trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return validYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  if (/^\d{9,10}$|^\d{12,13}$/.test(text)) return fromEpoch(Number(text))
  const ymd = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(text)
  if (ymd) return validYmd(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text)
  if (!dmy) return null
  const year = Number(dmy[3]) + (dmy[3].length === 2 ? 2000 : 0)
  const [a, b] = [Number(dmy[1]), Number(dmy[2])]
  return validYmd(year, b, a) ?? validYmd(year, a, b)
}

/**
 * What a tapped value fills in `field`, or null when it cannot be read as one. An amount
 * picked together with a currency code ("SAR 152.75") brings the currency along.
 */
export function readPick(
  field: PickField,
  pick: PayloadPick,
  currency: CurrencyCode,
): PickedValues | null {
  const text = pick.text.trim()
  switch (field) {
    case 'amount': {
      const line = typeof pick.value === 'number' ? String(pick.value) : text
      const read = readLineValues(line, currency)
      if (read.amountMinor == null) return null
      const next = read.currency ?? currency
      return {
        amount: minorToInputValue(read.amountMinor, next),
        ...(read.currency ? { currency: read.currency } : {}),
      }
    }
    case 'currency': {
      const code = text.toUpperCase()
      if (/^[A-Z]{3}$/.test(code) && isSupportedCurrency(code)) {
        return { currency: code }
      }
      const found = readLineValues(text, currency).currency
      return found ? { currency: found } : null
    }
    case 'date': {
      const date = readDateValue(
        typeof pick.value === 'number' ? pick.value : text,
      )
      return date ? { date } : null
    }
    case 'merchant':
    case 'note':
      return text ? { [field]: text.slice(0, TEXT_MAX) } : null
  }
}

/**
 * Where the next tap goes: amount, then currency, then date — the order a person fills a
 * transaction in — skipping currency when the amount's tap already carried one. The
 * optional fields keep the target, so the user can re-tap to correct them.
 */
export function nextTarget(field: PickField, picked: PickedValues): PickField {
  if (field === 'amount') return picked.currency ? 'date' : 'currency'
  if (field === 'currency') return 'date'
  return field
}

/** The first tap fills what is still missing, else the merchant. */
export function firstTarget(amount: string, hasCurrency: boolean): PickField {
  if (!amount.trim()) return 'amount'
  if (!hasCurrency) return 'currency'
  return 'merchant'
}
