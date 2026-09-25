import { describe, expect, it, vi } from 'vitest'
import { testContext, testMapping } from '../__fixtures__/mapping'
import { ROW_ISSUES } from '../types'
import { loadFixture } from './__fixtures__/fixtures'
import { readCsv } from './read'
import { buildRow, buildRows, buildRowsAsync } from './rows'
import type { Mapping, ParsedRow, RowContext } from '../types'

const LIMITS = { maxRows: 50_000, maxBytes: 10 * 1024 * 1024 }

/** The reader is phase 4's; this suite is about what a mapping makes of its output. */
const rowsOf = (name: string): string[][] =>
  readCsv(loadFixture(name).bytes, { limits: LIMITS }).rows

const codes = (row: ParsedRow): string[] =>
  row.issues.map((issue) => issue.code)

const build = (
  matrix: string[][],
  mapping: Mapping,
  context: RowContext = testContext(),
): ParsedRow[] => buildRows(matrix, mapping, context)

describe('buildRows — a split-column statement', () => {
  const UK_MAPPING = testMapping({
    dateFormat: 'DD/MM/YYYY',
    roles: ['date', 'merchant', 'type', 'amountOut', 'amountIn', 'skip'],
    amount: { kind: 'split', outColumn: 3, inColumn: 4 },
    defaults: {
      walletId: 'w1',
      currency: 'GBP',
      type: 'spend',
      category: 'other',
      subcategory: null,
    },
  })
  const context = testContext({ walletCurrencies: { w1: 'GBP' } })
  const rows = build(rowsOf('uk-bank.csv'), UK_MAPPING, context)

  it('reads the first row whole and stably', () => {
    expect(rows[0]).toEqual({
      index: 0,
      line: 2,
      raw: [
        '16/06/2026',
        'TESCO STORES 3411, LONDON',
        'DEB',
        '42.15',
        '',
        '1857.20',
      ],
      draft: {
        type: 'spend',
        amount: 4215,
        currency: 'GBP',
        category: 'other',
        subcategory: null,
        walletId: 'w1',
        goalId: null,
        merchantId: null,
        date: '2026-06-16',
        note: 'TESCO STORES 3411, LONDON',
      },
      intent: 'cashflow',
      transfer: null,
      issues: [
        {
          level: 'warning',
          field: 'category',
          code: ROW_ISSUES.categoryDefaulted,
        },
      ],
      duplicateOf: null,
      duplicateOfIndex: null,
      fingerprint: '2026-06-16|spend|4215|GBP|w1|tesco stores 3411 london',
      reference: null,
      excluded: false,
      prediction: null,
    })
  })

  it('reads direction from the column the amount sits in', () => {
    expect(
      rows.map((row) => [
        row.line,
        row.draft?.date,
        row.draft?.type,
        row.draft?.amount,
      ]),
    ).toEqual([
      [2, '2026-06-16', 'spend', 4215],
      [3, '2026-06-17', 'income', 245000],
      [4, '2026-06-18', 'spend', 840],
      [5, '2026-06-19', 'spend', 12999],
      [6, '2026-06-23', 'income', 100000],
      [7, '2026-06-30', 'spend', 123456],
    ])
  })

  it('never reads the running balance column', () => {
    expect(rows.every((row) => row.draft !== null)).toBe(true)
    expect(rows.map((row) => row.draft?.amount)).not.toContain(185720)
  })

  it('blocks a row with both an in and an out amount', () => {
    const row = buildRow(
      ['16/06/2026', 'BOTH', 'DEB', '42.15', '10.00', ''],
      0,
      UK_MAPPING,
      context,
    )
    expect(codes(row)).toContain(ROW_ISSUES.amountAmbiguous)
    expect(row.draft).toBeNull()
  })

  it('blocks a row with neither', () => {
    const row = buildRow(
      ['16/06/2026', 'NEITHER', 'DEB', '', '', ''],
      0,
      UK_MAPPING,
      context,
    )
    expect(codes(row)).toContain(ROW_ISSUES.amountMissing)
    expect(row.draft).toBeNull()
  })
})

describe('buildRows — our own export', () => {
  const EXPORT_MAPPING = testMapping({
    dateFormat: 'YYYY-MM-DD',
    roles: [
      'date',
      'type',
      'amount',
      'currency',
      'category',
      'subcategory',
      'wallet',
      'note',
    ],
    amount: { kind: 'typed', column: 2, typeColumn: 1 },
    amountUnit: 'minor',
    aliases: {
      wallets: {
        'al rajhi current': { kind: 'wallet', walletId: 'w1' },
        'visa card': { kind: 'wallet', walletId: 'w2' },
        cash: { kind: 'wallet', walletId: 'w3' },
      },
      categories: {
        'groceries supermarket': {
          kind: 'category',
          category: 'groceries',
          subcategory: 'supermarket',
        },
        salary: { kind: 'category', category: 'salary', subcategory: null },
      },
      merchants: {},
      types: {},
      currencies: {},
    },
  })
  const context = testContext({
    walletCurrencies: { w1: 'SAR', w2: 'SAR', w3: 'SAR' },
  })
  const matrix = rowsOf('means-export.csv')

  it('reads amount_minor as minor units, not as major', () => {
    const rows = build(matrix, EXPORT_MAPPING, context)
    expect(rows.map((row) => row.draft?.amount)).toEqual([
      1200000, 14250, 3500, 89900, 25000,
    ])
  })

  it('would be 100× out without the minor-unit flag', () => {
    const rows = build(
      matrix,
      { ...EXPORT_MAPPING, amountUnit: 'major' },
      context,
    )
    expect(rows[0].draft?.amount).toBe(120000000)
  })

  it('takes direction from the type column and targets from the aliases', () => {
    const rows = build(matrix, EXPORT_MAPPING, context)
    expect(rows[0].draft).toMatchObject({
      type: 'income',
      category: 'salary',
      walletId: 'w1',
      note: 'June salary',
    })
    expect(rows[1].draft).toMatchObject({
      type: 'spend',
      category: 'groceries',
      subcategory: 'supermarket',
      walletId: 'w1',
      note: 'Carrefour, Riyadh Park',
    })
    expect(codes(rows[1])).toEqual([])
  })

  it('falls back to the default category, and says so', () => {
    const rows = build(matrix, EXPORT_MAPPING, context)
    expect(rows[2].draft?.category).toBe('other')
    expect(codes(rows[2])).toEqual([ROW_ISSUES.categoryDefaulted])
  })
})

describe('buildRows — currencies', () => {
  const WISE_MAPPING = testMapping({
    roles: ['date', 'merchant', 'amount', 'currency'],
    amount: { kind: 'signed', column: 2, negativeMeans: 'spend' },
  })
  const rows = build(rowsOf('wise-multi-currency.csv'), WISE_MAPPING)

  it('scales each row by its own currency', () => {
    expect(
      rows.map((row) => [
        row.draft?.currency ?? null,
        row.draft?.amount ?? null,
      ]),
    ).toEqual([
      ['JPY', 1234],
      ['JPY', 450000],
      ['KWD', 1234],
      ['SAR', 1850],
      [null, null],
    ])
  })

  it('blames the currency cell, not the amount, for an unknown code', () => {
    expect(codes(rows[4])).toContain(ROW_ISSUES.currencyUnsupported)
    expect(codes(rows[4])).not.toContain(ROW_ISSUES.amountUnreadable)
    expect(
      rows[4].issues.find((i) => i.code === ROW_ISSUES.currencyUnsupported),
    ).toMatchObject({ detail: 'BTC' })
  })

  it('warns when a row is not in its wallet currency', () => {
    expect(codes(rows[0])).toContain(ROW_ISSUES.currencyMismatch)
    expect(codes(rows[3])).not.toContain(ROW_ISSUES.currencyMismatch)
  })
})

describe('buildRows — a messy file', () => {
  const MESSY_MAPPING = testMapping({
    roles: ['date', 'merchant', 'amount', 'wallet'],
    aliases: {
      ...testMapping().aliases,
      wallets: { current: { kind: 'wallet', walletId: 'w1' } },
    },
  })
  const rows = build(rowsOf('messy.csv'), MESSY_MAPPING)

  it('keeps a newline inside a quoted description', () => {
    expect(rows[0].draft?.note).toContain('BOOKSHOP AL JARIR')
    expect(rows[0].draft?.note).toContain('ORDER 88104')
  })

  it('warns about a short row and still imports it', () => {
    expect(codes(rows[1])).toContain(ROW_ISSUES.ragged)
    expect(rows[1].draft?.walletId).toBe('w1')
  })

  it('blocks an unreadable amount', () => {
    const unreadable = rows.find((row) => row.raw[2] === 'N/A')!
    expect(codes(unreadable)).toContain(ROW_ISSUES.amountUnreadable)
    expect(unreadable.draft).toBeNull()
  })

  it('warns about a date in the far future', () => {
    const future = rows.find((row) => row.draft?.date === '2099-01-01')!
    expect(codes(future)).toContain(ROW_ISSUES.dateImplausible)
  })
})

describe('buildRows — mapping decisions', () => {
  it('excludes rows whose account was mapped to skip, silently', () => {
    const mapping = testMapping({
      roles: ['date', 'merchant', 'amount', 'wallet'],
      aliases: {
        ...testMapping().aliases,
        wallets: { petty: { kind: 'skip' } },
      },
    })
    const row = buildRow(
      ['2026-06-16', 'Bakery', '-12.40', 'Petty'],
      0,
      mapping,
      testContext(),
    )
    expect(row.excluded).toBe(true)
    expect(row.issues).toEqual([
      {
        level: 'warning',
        field: 'category',
        code: ROW_ISSUES.categoryDefaulted,
      },
    ])
    expect(row.draft).toBeNull()
  })

  it('blocks a row with no account and no default', () => {
    const mapping = testMapping({
      defaults: { ...testMapping().defaults, walletId: null },
    })
    const row = buildRow(
      ['2026-06-16', 'Bakery', '-12.40'],
      0,
      mapping,
      testContext(),
    )
    expect(codes(row)).toContain(ROW_ISSUES.walletUnresolved)
  })

  it('reads a type word through the seed dictionary when no alias binds it', () => {
    const mapping = testMapping({
      roles: ['date', 'merchant', 'amount', 'type'],
      amount: { kind: 'typed', column: 2, typeColumn: 3 },
    })
    const spend = buildRow(
      ['2026-06-16', 'X', '142.50', 'DR'],
      0,
      mapping,
      testContext(),
    )
    const income = buildRow(
      ['2026-06-16', 'X', '142.50', 'CR'],
      0,
      mapping,
      testContext(),
    )
    const unknown = buildRow(
      ['2026-06-16', 'X', '142.50', 'ZZ'],
      0,
      mapping,
      testContext(),
    )
    expect(spend.draft?.type).toBe('spend')
    expect(income.draft?.type).toBe('income')
    expect(unknown.draft?.type).toBe('spend')
    expect(codes(unknown)).toContain(ROW_ISSUES.typeDefaulted)
  })

  it('files the bank reference into the note, where dedupe can find it again', () => {
    const mapping = testMapping({
      roles: ['date', 'merchant', 'amount', 'reference'],
    })
    const row = buildRow(
      ['2026-06-16', 'CARREFOUR', '-142.50', 'TXN8841003'],
      0,
      mapping,
      testContext(),
    )
    expect(row.reference).toBe('TXN8841003')
    expect(row.draft?.note).toBe('CARREFOUR · ref:TXN8841003')
  })

  it('leaves the note free once a merchant is bound', () => {
    const mapping = testMapping({
      aliases: {
        ...testMapping().aliases,
        merchants: { carrefour: { kind: 'merchant', merchantId: 'm1' } },
      },
    })
    const row = buildRow(
      ['2026-06-16', 'Carrefour', '-142.50'],
      0,
      mapping,
      testContext(),
    )
    expect(row.draft?.merchantId).toBe('m1')
    expect(row.draft?.note).toBeNull()
  })

  it('counts lines from the preamble the dialect skipped', () => {
    const mapping = testMapping({
      dialect: { ...testMapping().dialect, skipRows: 4 },
    })
    expect(
      buildRow(['2026-06-16', 'X', '-1.00'], 0, mapping, testContext()).line,
    ).toBe(6)
  })
})

describe('buildRowsAsync', () => {
  const mapping = testMapping()
  const matrix = Array.from({ length: 10 }, (_, index) => [
    '2026-06-16',
    `Row ${index}`,
    '-1.00',
  ])

  it('builds exactly what the synchronous pass builds', async () => {
    const chunked = await buildRowsAsync(matrix, mapping, testContext(), {
      chunkSize: 3,
    })
    expect(chunked).toEqual(buildRows(matrix, mapping, testContext()))
  })

  it('reports progress per chunk', async () => {
    const onProgress = vi.fn()
    await buildRowsAsync(matrix, mapping, testContext(), {
      chunkSize: 4,
      onProgress,
    })
    expect(onProgress.mock.calls).toEqual([
      [4, 10],
      [8, 10],
      [10, 10],
    ])
  })

  it('stops when the caller aborts', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      buildRowsAsync(matrix, mapping, testContext(), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'import.file.cancelled' })
  })
})
