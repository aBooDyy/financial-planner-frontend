import { describe, expect, it } from 'vitest'
import { CSV_FILE_ERRORS, CsvFileError } from './errors'
import { toImportLimits } from './caps'
import { PROGRESS_EVERY_ROWS, readCsv } from './read'

const LIMITS = { maxRows: 50_000, maxBytes: 10 * 1024 * 1024 }

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text)

const generate = (rows: number): string => {
  const lines = ['Date,Description,Amount,Currency']
  for (let i = 0; i < rows; i += 1) {
    lines.push(
      `2026-06-${String((i % 28) + 1).padStart(2, '0')},"MERCHANT, ${i}",${(i % 5000) / 100 - 25},SAR`,
    )
  }
  return lines.join('\n')
}

const codeOf = (run: () => unknown): string => {
  try {
    run()
  } catch (error) {
    return error instanceof CsvFileError ? error.code : 'not-a-csv-error'
  }
  return 'no-error'
}

describe('readCsv caps', () => {
  it('rejects an empty file', () => {
    expect(codeOf(() => readCsv(bytesOf(''), { limits: LIMITS }))).toBe(
      CSV_FILE_ERRORS.empty,
    )
    expect(codeOf(() => readCsv(bytesOf('   \n\n'), { limits: LIMITS }))).toBe(
      CSV_FILE_ERRORS.empty,
    )
  })

  it('rejects a file over the byte cap before decoding it', () => {
    const limits = { maxRows: 10, maxBytes: 8 }
    expect(
      codeOf(() => readCsv(bytesOf('Date,Amount\n2026-06-16,1'), { limits })),
    ).toBe(CSV_FILE_ERRORS.tooLarge)
  })

  it('rejects a file over the row cap', () => {
    const limits = { maxRows: 5, maxBytes: LIMITS.maxBytes }
    expect(codeOf(() => readCsv(bytesOf(generate(200)), { limits }))).toBe(
      CSV_FILE_ERRORS.tooManyRows,
    )
  })

  it('accepts a file exactly at the row cap', () => {
    const limits = { maxRows: 6, maxBytes: LIMITS.maxBytes }
    expect(readCsv(bytesOf(generate(6)), { limits }).rowCount).toBe(6)
  })

  it('rejects a file with only one column', () => {
    expect(
      codeOf(() =>
        readCsv(bytesOf('Description\nCoffee\nBooks\n'), { limits: LIMITS }),
      ),
    ).toBe(CSV_FILE_ERRORS.singleColumn)
  })

  it('takes its caps from the config limits block', () => {
    expect(
      toImportLimits({ importMaxRows: 50_000, importMaxBytes: 10_485_760 }),
    ).toEqual({ maxRows: 50_000, maxBytes: 10_485_760 })
  })
})

describe('readCsv', () => {
  it('reports progress while tokenising', () => {
    const seen: number[] = []
    readCsv(bytesOf(generate(PROGRESS_EVERY_ROWS * 3)), {
      limits: LIMITS,
      onProgress: (rows) => seen.push(rows),
    })
    expect(seen.length).toBeGreaterThanOrEqual(3)
    expect(seen[0]).toBe(PROGRESS_EVERY_ROWS)
  })

  it('honours the overrides the Adjust dialog produces', () => {
    const text = 'Datum;Betrag\n16.06.2026;1.234,56\n17.06.2026;2.000,00\n'
    const result = readCsv(bytesOf(text), {
      limits: LIMITS,
      overrides: { decimal: '.', hasHeader: false },
    })
    expect(result.dialect.decimal).toBe('.')
    expect(result.dialect.hasHeader).toBe(false)
    expect(result.headers).toEqual([])
    expect(result.rowCount).toBe(3)
  })

  /**
   * A guard against a catastrophic regression, not a benchmark: the real budget is measured
   * under CPU throttling and lives in the testing plan. What matters structurally is that
   * this whole function runs in the worker.
   */
  it('reads a file at the 50 000-row cap', () => {
    const started = performance.now()
    const result = readCsv(bytesOf(generate(50_000)), { limits: LIMITS })
    expect(result.rowCount).toBe(50_000)
    expect(result.rows[49_999][1]).toBe('MERCHANT, 49999')
    expect(performance.now() - started).toBeLessThan(10_000)
  })

  it('keeps data cells verbatim and trims only the headers', () => {
    const result = readCsv(bytesOf(' Date , Amount \n 2026-06-16 , 1.00 \n'), {
      limits: LIMITS,
    })
    expect(result.headers).toEqual(['Date', 'Amount'])
    expect(result.rows[0]).toEqual([' 2026-06-16 ', ' 1.00 '])
  })
})
