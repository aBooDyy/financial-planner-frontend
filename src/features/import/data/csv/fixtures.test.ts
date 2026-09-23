import { describe, expect, it } from 'vitest'
import { loadFixtures } from './__fixtures__/fixtures'
import { parseAmountCell } from './amounts'
import { inferDateFormat, parseDateCell } from './dates'
import { readCsv } from './read'

/**
 * The corpus drives one suite: every fixture must read to the dialect, date format and
 * amounts its `.expected.json` states. A change in detection that helps one bank and breaks
 * another shows up here rather than in someone's statement.
 */

const LIMITS = { maxRows: 50_000, maxBytes: 10 * 1024 * 1024 }

describe.each(loadFixtures())('$name', ({ name, bytes, expected }) => {
  const result = readCsv(bytes, { limits: LIMITS })

  it(`detects the dialect — ${expected.exercises}`, () => {
    expect(result.dialect).toEqual(expected.dialect)
    expect(result.headers).toEqual(expected.headers)
    expect(result.rowCount).toBe(expected.rowCount)
    expect(result.columnCount).toBe(expected.columnCount)
  })

  it('infers the date format over the whole column', () => {
    const column = result.rows.map((row) => row[expected.dates.column] ?? '')
    const inferred = inferDateFormat(column)
    expect(inferred.format).toBe(expected.dates.format)
    expect(inferred.ambiguous).toBe(expected.dates.ambiguous)
    for (const sample of expected.dates.samples) {
      const cell = result.rows[sample.row][expected.dates.column]
      expect(parseDateCell(cell, inferred.format!)).toBe(sample.iso)
    }
  })

  it('parses amounts to minor units', () => {
    for (const amount of expected.amounts) {
      const cell = result.rows[amount.row][amount.column] ?? ''
      const parsed = parseAmountCell(
        cell,
        result.dialect.decimal,
        amount.currency,
      )
      if (amount.minor === null) {
        expect(parsed, `${name} row ${amount.row}: "${cell}"`).toBeNull()
        continue
      }
      expect(parsed, `${name} row ${amount.row}: "${cell}"`).toEqual({
        minor: amount.minor,
        negative: amount.negative ?? false,
      })
    }
  })
})
