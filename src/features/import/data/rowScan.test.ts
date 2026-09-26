import { describe, expect, it } from 'vitest'
import { catId } from '#/features/categories/__fixtures__/categories'
import { testContext, testMapping } from './__fixtures__/mapping'
import { loadFixture } from './csv/__fixtures__/fixtures'
import { readCsv } from './csv/read'
import { buildRows } from './csv/rows'
import { buildDedupeIndex, emptySeen, markRow, withDuplicate } from './dedupe'
import { merchantLookup, predictRow } from './predict'
import { countStatuses, reviewOrder, statusOf } from './review'
import {
  rowReader,
  scanRows,
  scanRowsSync,
  statusAt,
  transferAt,
} from './rowScan'
import { ROW_ISSUES } from './types'
import { moneyLover } from './__fixtures__/moneyLover'
import type { MerchantIndex } from '#/features/merchants/data/matching'
import type { LedgerTransaction } from './dedupe'
import type { Mapping } from './types'

const LIMITS = { maxRows: 50_000, maxBytes: 10 * 1024 * 1024 }

const NO_MERCHANTS: MerchantIndex = { merchants: [], aliases: [] }

const MAPPING = testMapping({
  roles: ['date', 'merchant', 'amount', 'wallet'],
  aliases: {
    ...testMapping().aliases,
    wallets: { current: { kind: 'wallet', walletId: 'w1' } },
  },
})

const messyMatrix = () =>
  readCsv(loadFixture('messy.csv').bytes, { limits: LIMITS }).rows

const LEDGER: LedgerTransaction[] = [
  {
    id: 'existing',
    date: '2026-06-18',
    type: 'spend',
    amount: 450,
    currency: 'SAR',
    walletId: 'w1',
    categoryId: catId('other'),
    note: 'DUPLICATE COFFEE',
  },
]

/** The pipeline as it used to run: build every row, predict over it, mark duplicates. */
const theOldWay = (
  matrix: ReadonlyArray<ReadonlyArray<string>>,
  mapping: Mapping,
  ledger: LedgerTransaction[],
) => {
  const merchants = merchantLookup(NO_MERCHANTS)
  const index = buildDedupeIndex(ledger)
  const seen = emptySeen()
  const context = testContext()
  return buildRows(matrix, mapping, context)
    .map((row) => predictRow(row, mapping, merchants, context.categoryTypes))
    .map((row) =>
      withDuplicate(
        row,
        markRow(row, index, seen, mapping.dedupe) ?? undefined,
      ),
    )
}

const scanOf = (
  matrix: ReadonlyArray<ReadonlyArray<string>>,
  ledger: LedgerTransaction[] = [],
) =>
  scanRowsSync({
    matrix,
    mapping: MAPPING,
    context: testContext(),
    merchants: NO_MERCHANTS,
    ledger: buildDedupeIndex(ledger),
  })

describe('scanRows', () => {
  it('says exactly what a pass over every built row would have said', () => {
    const matrix = messyMatrix()
    const rows = theOldWay(matrix, MAPPING, LEDGER)
    const scan = scanOf(matrix, LEDGER)

    expect(scan.total).toBe(rows.length)
    expect(scan.counts).toEqual(countStatuses(rows))
    expect([...scan.order]).toEqual(reviewOrder(rows))
    expect(rows.map((_row, index) => statusAt(scan, index))).toEqual(
      rows.map(statusOf),
    )
  })

  it('keeps a mark only for the rows that repeat something', () => {
    const matrix = messyMatrix()
    const rows = theOldWay(matrix, MAPPING, LEDGER)
    const scan = scanOf(matrix, LEDGER)

    const marked = rows.filter(
      (row) => row.duplicateOf !== null || row.duplicateOfIndex !== null,
    )
    expect(marked.length).toBeGreaterThan(0)
    expect(scan.duplicates.size).toBe(marked.length)
    for (const row of marked) {
      expect(scan.duplicates.get(row.index)).toEqual({
        ledgerId: row.duplicateOf,
        earlierIndex: row.duplicateOfIndex,
      })
    }
    expect(scan.duplicateIds).toEqual(['existing'])
  })

  it('counts how many rows each issue touches, worst first', () => {
    const scan = scanOf(messyMatrix())
    const rows = theOldWay(messyMatrix(), MAPPING, [])

    for (const issue of scan.issues) {
      expect(issue.count).toBe(
        rows.filter((row) => row.issues.some((one) => one.code === issue.code))
          .length,
      )
    }
    expect(scan.issues.at(0)?.level).toBe('error')
  })

  it('yields between slices and stops when the signal says so', async () => {
    const matrix = messyMatrix()
    const seen: number[] = []
    const scan = await scanRows(
      {
        matrix,
        mapping: MAPPING,
        context: testContext(),
        merchants: NO_MERCHANTS,
        ledger: buildDedupeIndex([]),
      },
      { chunkSize: 2, onProgress: (done) => seen.push(done) },
    )
    expect(seen.length).toBeGreaterThan(1)
    expect(seen.at(-1)).toBe(matrix.length)
    expect(scan.total).toBe(matrix.length)

    const controller = new AbortController()
    controller.abort()
    await expect(
      scanRows(
        {
          matrix,
          mapping: MAPPING,
          context: testContext(),
          merchants: NO_MERCHANTS,
          ledger: buildDedupeIndex([]),
        },
        { chunkSize: 2, signal: controller.signal },
      ),
    ).rejects.toThrow()
  })
})

describe('rowReader', () => {
  it('builds one row exactly as the pass saw it, marks and all', () => {
    const matrix = messyMatrix()
    const rows = theOldWay(matrix, MAPPING, LEDGER)
    const scan = scanOf(matrix, LEDGER)
    const reader = rowReader({
      matrix,
      mapping: MAPPING,
      context: testContext(),
      merchants: NO_MERCHANTS,
      duplicates: scan.duplicates,
    })

    for (const row of rows) expect(reader.at(row.index)).toEqual(row)
  })
})

describe('transfers in a Money Lover export', () => {
  const { matrix, mapping, context } = moneyLover()
  const scan = scanRowsSync({
    matrix,
    mapping,
    context,
    merchants: NO_MERCHANTS,
    ledger: buildDedupeIndex([]),
  })
  const reader = rowReader({
    matrix,
    mapping,
    context,
    merchants: NO_MERCHANTS,
    duplicates: scan.duplicates,
    pairs: scan.pairs,
  })

  it('reads "Transfer" and "Balance adjustment" as movements, not categories', () => {
    expect(mapping.aliases.categories).toMatchObject({
      transfer: { kind: 'transfer' },
      'balance adjustment': { kind: 'adjustment' },
    })
    expect(reader.at(9).intent).toBe('adjustment')
    expect(reader.at(0).intent).toBe('cashflow')
  })

  it('pairs the two sides of each whole transfer — the same day, or a day apart', () => {
    expect([...scan.pairs.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [3, { partner: 4, walletId: 'w2' }],
      [4, { partner: 3, walletId: 'w1' }],
      [5, { partner: 6, walletId: 'w3' }],
      [6, { partner: 5, walletId: 'w1' }],
    ])
    expect(reader.at(4).transfer).toEqual({
      pairIndex: 3,
      counterpartId: 'w1',
      guessed: false,
    })
    expect(statusAt(scan, 3)).toBe('ok')
  })

  it('takes a lone side’s other wallet from its note, and blocks one with none', () => {
    expect(reader.at(7).transfer?.counterpartId).toBe('w2')
    expect(statusAt(scan, 7)).toBe('warning')
    expect(reader.at(8).issues.map((issue) => issue.code)).toContain(
      ROW_ISSUES.transferUnpaired,
    )
    expect(statusAt(scan, 8)).toBe('error')
  })

  it('says exactly what the rows it builds say', () => {
    const rows = matrix.map((_cells, index) => reader.at(index))
    expect(scan.counts).toEqual(countStatuses(rows))
    rows.forEach((row, index) =>
      expect(statusAt(scan, index)).toBe(statusOf(row)),
    )
    expect(rows.filter((row) => transferAt(scan, row.index))).toHaveLength(6)
  })
})
