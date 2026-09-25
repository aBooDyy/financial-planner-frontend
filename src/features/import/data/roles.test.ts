import { describe, expect, it } from 'vitest'
import { loadFixtures } from './csv/__fixtures__/fixtures'
import { readCsv } from './csv/read'
import {
  detectAmountUnit,
  inferAmountMode,
  missedRoles,
  suggestColumns,
  suggestRoles,
} from './roles'
import type { ColumnRole } from './types'

const LIMITS = { maxRows: 50_000, maxBytes: 10 * 1024 * 1024 }

describe('suggestRoles — header synonyms', () => {
  it('reads an English bank statement', () => {
    expect(
      suggestRoles([
        'Date',
        'Description',
        'Type',
        'Paid out',
        'Paid in',
        'Balance',
      ]),
    ).toEqual(['date', 'merchant', 'type', 'amountOut', 'amountIn', 'skip'])
  })

  it('reads an Arabic bank statement', () => {
    expect(
      suggestRoles(['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد']),
    ).toEqual(['date', 'merchant', 'amountOut', 'amountIn', 'skip'])
  })

  it('reads the remaining roles by name, in both languages', () => {
    expect(
      suggestRoles([
        'Value date',
        'Currency',
        'Account',
        'Category',
        'Sub category',
        'Notes',
        'Reference',
      ]),
    ).toEqual([
      'date',
      'currency',
      'wallet',
      'category',
      'subcategory',
      'note',
      'reference',
    ])
    expect(
      suggestRoles(['العملة', 'الحساب', 'التصنيف', 'ملاحظات', 'المرجع']),
    ).toEqual(['currency', 'wallet', 'category', 'note', 'reference'])
  })

  it('prefers the more specific synonym', () => {
    expect(suggestRoles(['Posting date', 'Paid out', 'Paid in'])).toEqual([
      'date',
      'amountOut',
      'amountIn',
    ])
  })

  it('gives a single-valued role to one column only — the most specific header', () => {
    expect(suggestRoles(['Date', 'Transaction date', 'Amount'])).toEqual([
      'skip',
      'date',
      'amount',
    ])
  })
})

describe('suggestRoles — the balance guard', () => {
  const balances = [['12304.10'], ['12215.10'], ['20615.10']]

  it('never reads a running balance as an amount, by name', () => {
    expect(suggestRoles(['Running balance'], balances)).toEqual(['skip'])
    expect(suggestRoles(['الرصيد'], balances)).toEqual(['skip'])
  })

  it('never promotes it by content either', () => {
    const rows = [
      ['2026-06-16', '-42.00', '12304.10'],
      ['2026-06-17', '-10.00', '12294.10'],
    ]
    expect(suggestRoles(['Date', 'Amount', 'Closing balance'], rows)).toEqual([
      'date',
      'amount',
      'skip',
    ])
  })
})

describe('suggestRoles — content fallback', () => {
  it('promotes an unnamed date column', () => {
    const rows = [
      ['2026-06-16', 'Bakery'],
      ['2026-06-17', 'Pharmacy'],
    ]
    expect(suggestRoles(['', ''], rows)).toEqual(['date', 'skip'])
  })

  it('promotes an unnamed amount and currency column', () => {
    const rows = [
      ['2026-06-16', '-12.40', 'EUR'],
      ['2026-06-17', '2800.00', 'EUR'],
    ]
    expect(suggestRoles(['Col1', 'Col2', 'Col3'], rows)).toEqual([
      'date',
      'amount',
      'currency',
    ])
  })

  it('fills the missing half of a debit/credit pair, never a second amount', () => {
    const rows = [
      ['2026-06-16', '142.50', ''],
      ['2026-06-17', '', '12000.00'],
    ]
    expect(suggestRoles(['Date', 'Debit', ''], rows)).toEqual([
      'date',
      'amountOut',
      'amountIn',
    ])
  })

  it('promotes a closed vocabulary of type words once there is enough of it', () => {
    const rows = Array.from({ length: 24 }, (_, index) => [
      '2026-06-16',
      index % 2 === 0 ? 'DR' : 'CR',
    ])
    expect(suggestRoles(['Date', 'Col2'], rows)).toEqual(['date', 'type'])
    expect(suggestRoles(['Date', 'Col2'], rows.slice(0, 10))).toEqual([
      'date',
      'skip',
    ])
  })
})

describe('inferAmountMode', () => {
  it('reads a debit/credit pair as split', () => {
    expect(inferAmountMode(['date', 'amountOut', 'amountIn'])).toEqual({
      kind: 'split',
      outColumn: 1,
      inColumn: 2,
    })
  })

  it('reads an amount beside a type column as typed', () => {
    expect(inferAmountMode(['date', 'amount', 'type'])).toEqual({
      kind: 'typed',
      column: 1,
      typeColumn: 2,
    })
  })

  it('reads a lone amount as signed, money out by default', () => {
    expect(inferAmountMode(['date', 'amount'])).toEqual({
      kind: 'signed',
      column: 1,
      negativeMeans: 'spend',
    })
  })

  it('has nothing to say without an amount column', () => {
    expect(inferAmountMode(['date', 'merchant'])).toBeNull()
  })
})

describe('detectAmountUnit', () => {
  it('spots our own export, which writes minor units', () => {
    expect(detectAmountUnit(['date', 'type', 'amount_minor', 'currency'])).toBe(
      'minor',
    )
  })

  it('defaults to major units for every other file', () => {
    expect(detectAmountUnit(['Date', 'Description', 'Amount'])).toBe('major')
  })
})

/**
 * The corpus check the phase is measured by: every column of every fixture against the role
 * a person would pick. The one miss is a German header the seed table does not speak, which
 * content detection cannot rescue — a description column looks like nothing in particular.
 */
describe('suggestRoles — across the fixture corpus', () => {
  const EXPECTED: Record<string, ColumnRole[]> = {
    'alrajhi-ar.csv': ['date', 'merchant', 'amountOut', 'amountIn', 'skip'],
    'ambiguous-dates.csv': ['date', 'merchant', 'amount'],
    'european.csv': ['date', 'merchant', 'amount', 'currency'],
    'means-export.csv': [
      'date',
      'type',
      'amount',
      'currency',
      'category',
      'subcategory',
      'wallet',
      'note',
    ],
    'messy.csv': ['date', 'merchant', 'amount', 'wallet'],
    'money-lover.csv': [
      'skip',
      'date',
      'category',
      'subcategory',
      'amount',
      'currency',
      'wallet',
      'note',
      'skip',
      'skip',
      'skip',
      'skip',
    ],
    'pipe-delimited.csv': ['date', 'merchant', 'amountOut', 'amountIn'],
    'tab-delimited.csv': ['date', 'merchant', 'amount', 'currency'],
    'typed-column.csv': ['date', 'merchant', 'amount', 'type', 'reference'],
    'uk-bank.csv': [
      'date',
      'merchant',
      'type',
      'amountOut',
      'amountIn',
      'skip',
    ],
    'us-bank.csv': ['date', 'merchant', 'amount'],
    'utf16le-bom.csv': ['date', 'merchant', 'amount', 'currency'],
    'utf8-bom.csv': ['date', 'merchant', 'amount', 'currency'],
    'wise-multi-currency.csv': ['date', 'merchant', 'amount', 'currency'],
  }

  it('is at least 90 % correct, and misses only what it cannot know', () => {
    const misses: Array<{
      fixture: string
      column: number
      expected: ColumnRole
      got: ColumnRole
    }> = []
    let columns = 0

    for (const fixture of loadFixtures()) {
      const result = readCsv(fixture.bytes, { limits: LIMITS })
      const roles = suggestRoles(result.headers, result.rows)
      const expected = EXPECTED[fixture.name]
      expect(expected, `no expectation for ${fixture.name}`).toBeDefined()
      expected.forEach((role, column) => {
        columns += 1
        if (roles[column] !== role) {
          misses.push({
            fixture: fixture.name,
            column,
            expected: role,
            got: roles[column],
          })
        }
      })
    }

    expect(columns).toBe(70)
    expect(misses).toEqual([
      {
        fixture: 'european.csv',
        column: 1,
        expected: 'merchant',
        got: 'skip',
      },
    ])
    expect((columns - misses.length) / columns).toBeGreaterThanOrEqual(0.9)
  })

  it('reads our own export end to end, minor units included', () => {
    const fixture = loadFixtures().find((f) => f.name === 'means-export.csv')!
    const result = readCsv(fixture.bytes, { limits: LIMITS })
    const plan = suggestColumns(result.headers, result.rows)
    expect(plan.amountUnit).toBe('minor')
    expect(plan.amount).toEqual({ kind: 'typed', column: 2, typeColumn: 1 })
  })
})

describe('missedRoles', () => {
  const headers = ['Date', 'Account', 'Tags', 'Amount']

  it('names a skipped column whose header holds a role nothing carries', () => {
    expect(
      missedRoles(
        headers,
        ['date', 'skip', 'skip', 'amount'],
        ['wallet', 'category'],
      ),
    ).toEqual([
      { column: 1, header: 'Account', role: 'wallet' },
      { column: 2, header: 'Tags', role: 'category' },
    ])
  })

  it('says nothing about a role the mapping already carries', () => {
    expect(
      missedRoles(
        headers,
        ['date', 'wallet', 'category', 'amount'],
        ['wallet', 'category'],
      ),
    ).toEqual([])
  })
})
