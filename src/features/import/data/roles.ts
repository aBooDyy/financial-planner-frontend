import { isAmountLike } from './csv/amounts'
import { inferDateFormat, isDateLike } from './csv/dates'
import { matchType, normalizeKey } from './matching'
import { isExclusiveRole } from './types'
import { isSupportedCurrency } from '#/lib/currency'
import type { TxType } from '#/features/transactions/api/types'
import type { AmountMode, AmountUnit, ColumnRole } from './types'

/**
 * Header → what the column holds. Two passes: a bilingual synonym table over the header
 * name, then content sniffing for whatever is still unassigned.
 */

const ROLE_SYNONYMS: ReadonlyArray<
  readonly [ColumnRole, ReadonlyArray<string>]
> = [
  [
    'date',
    [
      'date',
      'transaction date',
      'posting date',
      'post date',
      'posted date',
      'value date',
      'booking date',
      'booked date',
      'booked',
      'completed date',
      'started date',
      'date of transaction',
      'تاريخ',
      'التاريخ',
      'تاريخ العملية',
      'تاريخ القيد',
      'تاريخ الحركة',
    ],
  ],
  [
    'amountOut',
    [
      'debit',
      'debits',
      'debit amount',
      'withdrawal',
      'withdrawals',
      'paid out',
      'money out',
      'amount out',
      'out',
      'spent',
      'مدين',
      'المدين',
      'سحب',
      'مسحوبات',
      'منصرف',
    ],
  ],
  [
    'amountIn',
    [
      'credit',
      'credits',
      'credit amount',
      'deposit',
      'deposits',
      'paid in',
      'money in',
      'amount in',
      'in',
      'received',
      'دائن',
      'الدائن',
      'ايداع',
      'ايداعات',
      'وارد',
    ],
  ],
  [
    'amount',
    [
      'amount',
      'value',
      'sum',
      'transaction amount',
      'amount minor',
      'المبلغ',
      'مبلغ',
      'القيمة',
      'قيمة',
    ],
  ],
  [
    'type',
    [
      'type',
      'transaction type',
      'dr cr',
      'cr dr',
      'debit credit',
      'direction',
      'نوع العملية',
      'النوع',
      'نوع',
    ],
  ],
  ['currency', ['currency', 'ccy', 'cur', 'curr', 'العملة', 'عملة']],
  [
    'wallet',
    [
      'account',
      'account name',
      'account number',
      'account no',
      'card',
      'card number',
      'wallet',
      'source',
      'الحساب',
      'حساب',
      'رقم الحساب',
      'البطاقة',
      'المحفظة',
    ],
  ],
  [
    'subcategory',
    ['subcategory', 'sub category', 'sub tag', 'sub type', 'التصنيف الفرعي'],
  ],
  [
    'category',
    [
      'category',
      'categories',
      'tag',
      'tags',
      'التصنيف',
      'تصنيف',
      'الفئة',
      'فئة',
    ],
  ],
  [
    'merchant',
    [
      'description',
      'details',
      'detail',
      'narrative',
      'merchant',
      'payee',
      'beneficiary',
      'counterparty',
      'remittance info',
      'transaction details',
      'name',
      'البيان',
      'بيان',
      'بيان العملية',
      'الوصف',
      'وصف',
      'التفاصيل',
      'المستفيد',
    ],
  ],
  [
    'note',
    [
      'note',
      'notes',
      'memo',
      'comment',
      'comments',
      'remarks',
      'ملاحظات',
      'ملاحظة',
    ],
  ],
  [
    'reference',
    [
      'reference',
      'ref',
      'ref no',
      'reference no',
      'reference number',
      'transaction id',
      'txn id',
      'transaction reference',
      'receipt no',
      'cheque no',
      'المرجع',
      'مرجع',
      'رقم العملية',
      'رقم المرجع',
    ],
  ],
]

/**
 * A running balance parses as an amount and importing it as one would post the whole
 * statement's totals as transactions. It is skipped by name, and content detection is never
 * allowed to promote it back.
 */
const BALANCE_WORDS: ReadonlyArray<string> = [
  'balance',
  'running balance',
  'closing balance',
  'available balance',
  'ledger balance',
  'balance after',
  'الرصيد',
  'رصيد',
]

type Synonym = { role: ColumnRole; key: string }

const SYNONYM_INDEX: ReadonlyArray<Synonym> = ROLE_SYNONYMS.flatMap(
  ([role, words]) => words.map((word) => ({ role, key: normalizeKey(word) })),
)

const ROLE_ORDER = new Map<ColumnRole, number>(
  ROLE_SYNONYMS.map(([role], position) => [role, position]),
)

const BALANCE_KEYS = BALANCE_WORDS.map(normalizeKey)

/** Whole-token containment: "posting date" holds "date", "update" does not. */
const containsWord = (haystack: string, needle: string): boolean =>
  needle !== '' && ` ${haystack} `.includes(` ${needle} `)

const isBalanceHeader = (key: string): boolean =>
  BALANCE_KEYS.some((word) => key === word || containsWord(key, word))

type Hit = { column: number; role: ColumnRole; score: number; length: number }

/** How many values of a column content detection looks at. */
const CONTENT_SAMPLE = 200

/** Below this a column's value set is too small to prove it is a closed type vocabulary. */
const TYPE_EVIDENCE_ROWS = 20
const TYPE_MAX_DISTINCT = 8

const columnValues = (
  samples: ReadonlyArray<ReadonlyArray<string>>,
  column: number,
): string[] => {
  const values: string[] = []
  for (const row of samples) {
    const value = (row[column] ?? '').trim()
    if (value !== '') values.push(value)
    if (values.length >= CONTENT_SAMPLE) break
  }
  return values
}

const looksLikeDates = (values: ReadonlyArray<string>): boolean =>
  values.length > 0 &&
  values.every(isDateLike) &&
  inferDateFormat(values).format !== null

const looksLikeAmounts = (values: ReadonlyArray<string>): boolean =>
  values.length > 0 && values.every(isAmountLike)

const CODE_RE = /^[A-Za-z]{3}$/

const looksLikeCurrencies = (values: ReadonlyArray<string>): boolean =>
  values.length > 0 &&
  values.every(
    (value) => CODE_RE.test(value) && isSupportedCurrency(value.toUpperCase()),
  )

const looksLikeTypes = (values: ReadonlyArray<string>): boolean => {
  if (values.length < TYPE_EVIDENCE_ROWS) return false
  const distinct = new Set(values.map((value) => value.toLowerCase()))
  if (distinct.size > TYPE_MAX_DISTINCT) return false
  return values.every((value) => matchType(value) !== null)
}

/**
 * The free amount role: a missing amount is filled, a second one is never invented. When one
 * side of a debit/credit pair is named and the other is not, the other side is the answer.
 */
const freeAmountRole = (
  roles: ReadonlyArray<ColumnRole>,
): ColumnRole | null => {
  const has = (role: ColumnRole) => roles.includes(role)
  if (!has('amount') && !has('amountIn') && !has('amountOut')) return 'amount'
  if (has('amountOut') && !has('amountIn')) return 'amountIn'
  if (has('amountIn') && !has('amountOut')) return 'amountOut'
  return null
}

const widestRow = (rows: ReadonlyArray<ReadonlyArray<string>>): number =>
  rows.reduce((widest, row) => Math.max(widest, row.length), 0)

/**
 * `suggestRoles(headers, samples)` — headers first, content for the rest. `samples` are data
 * rows (the header row is not one of them).
 */
export const suggestRoles = (
  headers: ReadonlyArray<string>,
  samples: ReadonlyArray<ReadonlyArray<string>> = [],
): ColumnRole[] => {
  const columnCount = Math.max(headers.length, widestRow(samples))
  const roles: ColumnRole[] = Array.from({ length: columnCount }, () => 'skip')
  const guarded = new Set<number>()
  const hits: Hit[] = []

  headers.forEach((header, column) => {
    const key = normalizeKey(header)
    if (key === '') return
    if (isBalanceHeader(key)) {
      guarded.add(column)
      return
    }
    for (const synonym of SYNONYM_INDEX) {
      const score =
        key === synonym.key ? 100 : containsWord(key, synonym.key) ? 70 : 0
      if (score > 0) {
        hits.push({
          column,
          role: synonym.role,
          score,
          length: synonym.key.length,
        })
      }
    }
  })

  // Strongest evidence first, then the most specific synonym, then the table's own order —
  // so "paid out" beats "out", and a tie between roles resolves the same way every run.
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      b.length - a.length ||
      (ROLE_ORDER.get(a.role) ?? 0) - (ROLE_ORDER.get(b.role) ?? 0) ||
      a.column - b.column,
  )

  const taken = new Set<ColumnRole>()
  const assign = (column: number, role: ColumnRole) => {
    roles[column] = role
    if (isExclusiveRole(role)) taken.add(role)
  }
  for (const hit of hits) {
    if (roles[hit.column] !== 'skip') continue
    if (isExclusiveRole(hit.role) && taken.has(hit.role)) continue
    assign(hit.column, hit.role)
  }

  for (let column = 0; column < columnCount; column += 1) {
    if (roles[column] !== 'skip' || guarded.has(column)) continue
    const values = columnValues(samples, column)
    if (!taken.has('date') && looksLikeDates(values)) {
      assign(column, 'date')
      continue
    }
    if (!taken.has('currency') && looksLikeCurrencies(values)) {
      assign(column, 'currency')
      continue
    }
    if (!taken.has('type') && looksLikeTypes(values)) {
      assign(column, 'type')
      continue
    }
    if (looksLikeAmounts(values)) {
      const role = freeAmountRole(roles)
      if (role) assign(column, role)
    }
  }

  return roles
}

export type RoleHint = { column: number; header: string; role: ColumnRole }

/**
 * Columns still on `skip` whose header names a role the mapping does not have. The file
 * usually does say which account a row belongs to; the column just never got marked, and
 * step ③ then has nothing to ask about.
 */
export const missedRoles = (
  headers: ReadonlyArray<string>,
  roles: ReadonlyArray<ColumnRole>,
  wanted: ReadonlyArray<ColumnRole>,
): RoleHint[] => {
  const missing = wanted.filter((role) => !roles.includes(role))
  if (missing.length === 0) return []
  const hints: RoleHint[] = []
  headers.forEach((header, column) => {
    if (roles[column] !== 'skip') return
    const key = normalizeKey(header)
    if (key === '') return
    // The most specific synonym wins, the same way `suggestRoles` ranks its own hits.
    const hits = SYNONYM_INDEX.filter(
      (synonym) =>
        missing.includes(synonym.role) &&
        (key === synonym.key || containsWord(key, synonym.key)),
    ).sort((a, b) => b.key.length - a.key.length)
    if (hits.length > 0) hints.push({ column, header, role: hits[0].role })
  })
  return hints
}

/** The amount shape the surviving roles imply. Null when no amount column was found. */
export const inferAmountMode = (
  roles: ReadonlyArray<ColumnRole>,
  negativeMeans: TxType = 'spend',
): AmountMode | null => {
  const column = (role: ColumnRole) => roles.indexOf(role)
  const out = column('amountOut')
  const income = column('amountIn')
  if (out >= 0 && income >= 0) {
    return { kind: 'split', outColumn: out, inColumn: income }
  }
  const single = column('amount')
  if (single < 0) return null
  const typeColumn = column('type')
  if (typeColumn >= 0) return { kind: 'typed', column: single, typeColumn }
  return { kind: 'signed', column: single, negativeMeans }
}

/** Headers a bank uses when its amount column is already scaled to minor units. */
export const MINOR_UNIT_HEADERS: ReadonlyArray<string> = [
  'amount minor',
  'minor amount',
  'amount in minor units',
  'amount minor units',
]

/**
 * Whether the amount column is written in the currency's minor units. Most banks write major
 * units, and reading a minor-unit column as major would divide every row by 100, so the
 * importer names the unit rather than guessing, and defaults to major when the file is silent.
 */
export const detectAmountUnit = (
  headers: ReadonlyArray<string>,
): AmountUnit => {
  const keys = headers.map(normalizeKey)
  return keys.some((key) => MINOR_UNIT_HEADERS.includes(key))
    ? 'minor'
    : 'major'
}

export type ColumnPlan = {
  roles: ColumnRole[]
  /** Null when no amount column was found — step ② cannot be completed until it is. */
  amount: AmountMode | null
  amountUnit: AmountUnit
}

/** Everything step ② proposes about columns, in one call. */
export const suggestColumns = (
  headers: ReadonlyArray<string>,
  samples: ReadonlyArray<ReadonlyArray<string>> = [],
): ColumnPlan => {
  const roles = suggestRoles(headers, samples)
  return {
    roles,
    amount: inferAmountMode(roles),
    amountUnit: detectAmountUnit(headers),
  }
}
