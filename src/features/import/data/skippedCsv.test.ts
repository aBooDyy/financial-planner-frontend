import { describe, expect, it } from 'vitest'
import { buildRows } from './csv/rows'
import { buildSkippedCsv, skipReason, skippedFileName } from './skippedCsv'
import { testContext, testMapping } from './__fixtures__/mapping'

const HEADERS = ['Date', 'Description', 'Amount']

const MATRIX = [
  ['2026-06-16', 'Bakery, the good one', '-12.40'],
  ['2026-06-17', 'REFUND', 'N/A'],
]

const built = () => buildRows(MATRIX, testMapping(), testContext())

describe('skipReason', () => {
  it('names the error, else says the user left the row out', () => {
    const rows = built()
    expect(skipReason(rows[1])).toContain('amount')
    expect(skipReason(rows[0])).toBe('You left this row out.')
  })
})

describe('buildSkippedCsv', () => {
  it('re-emits the file cells verbatim with a reason column appended', () => {
    const lines = buildSkippedCsv(built(), HEADERS, ',').split('\n')

    expect(lines[0]).toBe('Date,Description,Amount,_reason')
    // A cell holding the delimiter comes back quoted, so the file re-imports cleanly.
    expect(lines[1]).toContain('"Bakery, the good one"')
    expect(lines[1].startsWith('2026-06-16,')).toBe(true)
    expect(lines[2]).toContain('N/A')
    expect(lines).toHaveLength(3)
  })

  it('uses the file own delimiter and names columns the header did not', () => {
    const rows = buildRows(
      [['2026-06-16', 'Bakery', '-12.40', 'ref-9']],
      testMapping(),
      testContext(),
    )
    const lines = buildSkippedCsv(rows, HEADERS, ';').split('\n')

    expect(lines[0]).toBe('Date;Description;Amount;column_4;_reason')
    expect(lines[1]).toBe(
      '2026-06-16;Bakery;-12.40;ref-9;You left this row out.',
    )
  })
})

describe('skippedFileName', () => {
  it('marks the name without losing the extension', () => {
    expect(skippedFileName('alrajhi-2026-08.csv')).toBe(
      'alrajhi-2026-08-skipped.csv',
    )
    expect(skippedFileName('statement')).toBe('statement-skipped.csv')
    expect(skippedFileName('.hidden')).toBe('.hidden-skipped.csv')
  })
})
