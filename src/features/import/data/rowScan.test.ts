import { describe, expect, it } from 'vitest'
import { testContext, testMapping } from './__fixtures__/mapping'
import { loadFixture } from './csv/__fixtures__/fixtures'
import { readCsv } from './csv/read'
import { buildRows } from './csv/rows'
import { buildDedupeIndex, emptySeen, markRow, withDuplicate } from './dedupe'
import { merchantLookup, predictRow } from './predict'
import { countStatuses, reviewOrder, statusOf } from './review'
import { rowReader, scanRows, scanRowsSync, statusAt } from './rowScan'
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
    merchantId: null,
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
  return buildRows(matrix, mapping, testContext())
    .map((row) => predictRow(row, mapping, merchants))
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
