import { describe, expect, it } from 'vitest'
import {
  catId,
  categoryRow,
  defaultCatalog,
} from '#/features/categories/__fixtures__/categories'
import { buildCatalog } from '#/features/categories/data/catalog'
import {
  amountModeFor,
  assignRole,
  draftForFile,
  fallbackCategoriesOf,
  mappingReadiness,
  roleOptionsFor,
  toMapping,
  withAmountKind,
} from './mapping'
import type { MappingDraft } from './mapping'

const HEADERS = ['Date', 'Description', 'Debit', 'Credit', 'Balance']
const MATRIX = [
  ['01/08/2026', 'CARREFOUR HYPER', '142.50', '', '12304.10'],
  ['02/08/2026', 'STC', '89.00', '', '12215.10'],
  ['24/08/2026', 'SALARY', '', '8400.00', '20615.10'],
]

const aDraft = (): MappingDraft =>
  draftForFile({
    dialect: {
      delimiter: ',',
      quote: '"',
      encoding: 'utf-8',
      decimal: '.',
      skipRows: 0,
      hasHeader: true,
    },
    headers: HEADERS,
    matrix: MATRIX,
    currency: 'SAR',
    fallbackCategories: {
      spend: catId('other'),
      income: catId('other_income'),
    },
  })

describe('fallbackCategoriesOf', () => {
  it('falls each direction to its own required root', () => {
    expect(fallbackCategoriesOf(defaultCatalog())).toEqual({
      spend: catId('other'),
      income: catId('other_income'),
    })
  })

  it('takes the type’s first category when the required one is missing', () => {
    const catalog = buildCatalog([
      categoryRow({ slug: 'food' }),
      categoryRow({ slug: 'pay', type: 'income' }),
    ])
    expect(fallbackCategoriesOf(catalog)).toEqual({
      spend: catId('food'),
      income: catId('pay'),
    })
  })
})

describe('draftForFile', () => {
  it('proposes roles, the amount shape and the date format', () => {
    const draft = aDraft()
    expect(draft.roles).toEqual([
      'date',
      'merchant',
      'amountOut',
      'amountIn',
      'skip',
    ])
    expect(draft.amountKind).toBe('split')
    expect(draft.dateFormat).toBe('DD/MM/YYYY')
    expect(draft.dateAmbiguous).toBe(false)
    expect(draft.defaults).toEqual({
      walletId: null,
      currency: 'SAR',
      type: 'spend',
      categoryIds: { spend: catId('other'), income: catId('other_income') },
    })
  })

  it('resolves to a complete mapping', () => {
    expect(toMapping(aDraft())?.amount).toEqual({
      kind: 'split',
      outColumn: 2,
      inColumn: 3,
    })
  })
})

describe('assignRole', () => {
  it('moves a single-valued role rather than colliding', () => {
    const draft = assignRole(aDraft(), 4, 'date', MATRIX)
    expect(draft.roles[0]).toBe('skip')
    expect(draft.roles[4]).toBe('date')
  })

  it('re-infers the date format when the date column moves', () => {
    const iso = [
      ['2026-08-01', 'A', '1.00', '', ''],
      ['2026-08-02', 'B', '2.00', '', ''],
    ]
    const draft = assignRole(
      {
        ...aDraft(),
        roles: ['skip', 'merchant', 'amountOut', 'amountIn', 'skip'],
      },
      0,
      'date',
      iso,
    )
    expect(draft.dateFormat).toBe('YYYY-MM-DD')
  })

  it('leaves a repeatable role where it is', () => {
    const draft = assignRole(
      assignRole(aDraft(), 4, 'note', MATRIX),
      1,
      'note',
      MATRIX,
    )
    expect(draft.roles[1]).toBe('note')
    expect(draft.roles[4]).toBe('note')
  })
})

describe('withAmountKind', () => {
  it('carries the money-out column into a signed column', () => {
    const draft = withAmountKind(aDraft(), 'signed')
    expect(draft.roles).toEqual(['date', 'merchant', 'amount', 'skip', 'skip'])
    expect(amountModeFor(draft)).toEqual({
      kind: 'signed',
      column: 2,
      negativeMeans: 'spend',
    })
  })

  it('sends a signed column back to money out', () => {
    const draft = withAmountKind(withAmountKind(aDraft(), 'signed'), 'split')
    expect(draft.roles[2]).toBe('amountOut')
    expect(amountModeFor(draft)).toBeNull()
  })

  it('needs a type column before a typed shape resolves', () => {
    const typed = withAmountKind(aDraft(), 'typed')
    expect(amountModeFor(typed)).toBeNull()
    const withType = assignRole(typed, 4, 'type', MATRIX)
    expect(amountModeFor(withType)).toEqual({
      kind: 'typed',
      column: 2,
      typeColumn: 4,
    })
  })
})

describe('roleOptionsFor', () => {
  it('offers only the roles the chosen shape reads', () => {
    expect(roleOptionsFor('split')).not.toContain('amount')
    expect(roleOptionsFor('split')).toContain('amountIn')
    expect(roleOptionsFor('signed')).not.toContain('amountOut')
    expect(roleOptionsFor('signed')).not.toContain('type')
    expect(roleOptionsFor('typed')).toContain('type')
  })
})

describe('mappingReadiness', () => {
  it('is ready once a date and an amount configuration exist', () => {
    expect(mappingReadiness(aDraft())).toEqual({ ready: true, reason: null })
  })

  it('names the missing date column', () => {
    const draft = assignRole(aDraft(), 0, 'skip', MATRIX)
    expect(mappingReadiness(draft).reason).toBe(
      'Pick the column that holds the date.',
    )
  })

  it('names the missing half of a split pair', () => {
    const draft = assignRole(aDraft(), 3, 'skip', MATRIX)
    expect(mappingReadiness(draft)).toEqual({
      ready: false,
      reason: 'Pick the column that holds money in.',
    })
  })

  it('names the missing type column', () => {
    const draft = withAmountKind(aDraft(), 'typed')
    expect(mappingReadiness(draft).reason).toBe(
      'Pick the column that says whether a row is money in or money out.',
    )
  })
})
