import { describe, expect, it } from 'vitest'
import { catId } from '#/features/categories/__fixtures__/categories'
import { identityKey } from '#/features/merchants/data/matching'
import { testContext, testMapping } from './__fixtures__/mapping'
import { buildRows } from './csv/rows'
import { merchantLookup, predictRow } from './predict'
import { ROW_ISSUES } from './types'
import type { LocalMerchant, LocalMerchantAlias } from '#/db/types'
import type { MerchantIndex } from '#/features/merchants/data/matching'
import type { TxType } from '#/features/transactions/api/types'
import type { Mapping, ParsedRow } from './types'

const merchant = (overrides: Partial<LocalMerchant> = {}): LocalMerchant => ({
  id: 'm1',
  displayName: 'Carrefour',
  learnedCategoryId: catId('supermarket', 'groceries'),
  learnedType: 'spend',
  timesSeen: 12,
  timesConfirmed: 4,
  lastSeenAt: '2026-06-01T00:00:00Z',
  autoCategorize: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
  ...overrides,
})

const alias = (raw: string, merchantId = 'm1'): LocalMerchantAlias => ({
  id: `a-${raw}`,
  merchantId,
  normalizedKey: identityKey(raw),
  rawSample: raw,
  origin: 'email',
  createdAt: '2026-01-01T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
})

const index = (overrides: Partial<MerchantIndex> = {}): MerchantIndex => ({
  merchants: [merchant()],
  aliases: [alias('CARREFOUR HYPER 4471')],
  ...overrides,
})

const MAPPING = testMapping()

const rowsFor = (description: string, amount = '-142.50') =>
  buildRows([['2026-06-16', description, amount]], MAPPING, testContext())

const predictAll = (
  rows: ReadonlyArray<ParsedRow>,
  mapping: Mapping,
  merchants: MerchantIndex,
): ParsedRow[] => {
  const lookup = merchantLookup(merchants)
  const { categoryTypes } = testContext()
  return rows.map((row) => predictRow(row, mapping, lookup, categoryTypes))
}

describe('predictRow', () => {
  it('pre-fills a known merchant’s learned category', () => {
    const [row] = predictAll(rowsFor('CARREFOUR HYPER 4471'), MAPPING, index())
    expect(row.draft).toMatchObject({
      merchantId: 'm1',
      categoryId: catId('supermarket', 'groceries'),
    })
    expect(row.prediction).toEqual({
      merchantId: 'm1',
      merchantName: 'Carrefour',
      categoryId: catId('supermarket', 'groceries'),
      applied: true,
    })
  })

  it('drops the guessed-category warning once a category is applied', () => {
    const before = rowsFor('CARREFOUR HYPER 4471')
    expect(before[0].issues.map((i) => i.code)).toEqual([
      ROW_ISSUES.categoryDefaulted,
    ])
    const [row] = predictAll(before, MAPPING, index())
    expect(row.issues).toEqual([])
  })

  it('only offers the category when auto-categorise is off', () => {
    const [row] = predictAll(
      rowsFor('CARREFOUR HYPER 4471'),
      MAPPING,
      index({ merchants: [merchant({ autoCategorize: false })] }),
    )
    expect(row.draft?.merchantId).toBe('m1')
    expect(row.draft?.categoryId).toBe(catId('other'))
    expect(row.prediction).toMatchObject({ applied: false })
    expect(row.issues.map((i) => i.code)).toEqual([
      ROW_ISSUES.categoryDefaulted,
    ])
  })

  it('does not apply a category learned for the other direction', () => {
    const refund: TxType = 'income'
    const [row] = predictAll(
      rowsFor('CARREFOUR HYPER 4471'),
      MAPPING,
      index({
        merchants: [
          merchant({ learnedType: refund, learnedCategoryId: catId('refund') }),
        ],
      }),
    )
    expect(row.draft?.type).toBe('spend')
    expect(row.draft?.categoryId).toBe(catId('other'))
    expect(row.prediction).toBeNull()
  })

  it('judges the direction by the learned category itself, and skips one that is gone', () => {
    for (const learned of [
      merchant({ learnedType: null, learnedCategoryId: catId('salary') }),
      merchant({ learnedCategoryId: 'deleted-elsewhere' }),
    ]) {
      const [row] = predictAll(
        rowsFor('CARREFOUR HYPER 4471'),
        MAPPING,
        index({ merchants: [learned] }),
      )
      expect(row.draft?.categoryId).toBe(catId('other'))
      expect(row.prediction).toBeNull()
    }
  })

  it('never overwrites a category the file itself stated', () => {
    const mapping = testMapping({
      roles: ['date', 'merchant', 'amount', 'category'],
      aliases: {
        ...testMapping().aliases,
        categories: {
          dining: { kind: 'category', categoryId: catId('dining') },
        },
      },
    })
    const rows = buildRows(
      [['2026-06-16', 'CARREFOUR HYPER 4471', '-142.50', 'Dining']],
      mapping,
      testContext(),
    )
    const [row] = predictAll(rows, mapping, index())
    expect(row.draft?.categoryId).toBe(catId('dining'))
    expect(row.prediction).toMatchObject({ applied: false })
  })

  it('binds a merchant only when the match is confident', () => {
    const [row] = predictAll(
      rowsFor('AL NAHDI PHARMACY JEDDAH'),
      MAPPING,
      index({
        merchants: [merchant({ displayName: 'Al Nahdi Medical Riyadh' })],
        aliases: [],
      }),
    )
    expect(row.draft?.merchantId).toBeNull()
    expect(row.prediction).toBeNull()
  })

  it('re-derives the fingerprint once a learned category applies', () => {
    const before = rowsFor('CARREFOUR HYPER 4471')
    const [after] = predictAll(before, MAPPING, index())
    expect(after.fingerprint).not.toBe(before[0].fingerprint)
    expect(after.fingerprint).toContain(`c:${after.draft?.categoryId}`)
  })

  it('reads the prediction of a merchant the value step already bound', () => {
    const mapping = testMapping({
      aliases: {
        ...testMapping().aliases,
        merchants: {
          'some local shop': { kind: 'merchant', merchantId: 'm1' },
        },
      },
    })
    const rows = buildRows(
      [['2026-06-16', 'Some Local Shop', '-12.00']],
      mapping,
      testContext(),
    )
    const [row] = predictAll(rows, mapping, index())
    expect(row.draft?.categoryId).toBe(catId('supermarket', 'groceries'))
    expect(row.prediction).toMatchObject({ applied: true })
  })

  it('leaves a row it cannot commit alone', () => {
    const rows = buildRows(
      [['not a date', 'CARREFOUR HYPER 4471', '-142.50']],
      MAPPING,
      testContext(),
    )
    expect(predictAll(rows, MAPPING, index())[0]).toEqual(rows[0])
  })
})
