import { describe, expect, it } from 'vitest'
import {
  CAFES,
  DINING,
  GROCERIES,
  RESTAURANTS,
  catalog,
} from './__fixtures__/search'
import {
  dateBounds,
  filterCount,
  hasActiveFilters,
  pickWholeCategory,
  toggleCategory,
  toggleSubcategory,
  toggleWallet,
} from './filters'
import { EMPTY_SEARCH_FILTERS } from './types'
import type { SearchFilters } from './types'

const f = (over: Partial<SearchFilters> = {}): SearchFilters => ({
  ...EMPTY_SEARCH_FILTERS,
  ...over,
})

describe('filterCount', () => {
  it('counts the type, the date, each pick and the amount range once', () => {
    expect(filterCount(f())).toBe(0)
    expect(
      filterCount(
        f({
          type: 'spend',
          date: 'month',
          categoryIds: [DINING],
          subcategoryIds: ['a', 'b'],
          walletIds: ['w'],
          min: '10',
          max: '50',
        }),
      ),
    ).toBe(7)
  })

  it('ignores a custom range with both sides open and an unreadable amount', () => {
    const open = f({ date: 'custom', min: 'abc' })
    expect(filterCount(open)).toBe(0)
    expect(hasActiveFilters(open)).toBe(false)
    expect(hasActiveFilters(f({ max: '5' }))).toBe(true)
  })
})

describe('dateBounds', () => {
  const today = '2026-09-29'

  it('spans the calendar month, or the last N days including today', () => {
    expect(dateBounds(f({ date: 'month' }), today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(dateBounds(f({ date: '30' }), today)).toEqual({
      from: '2026-08-31',
      to: today,
    })
    expect(dateBounds(f({ date: '90' }), today)?.from).toBe('2026-07-02')
  })

  it('leaves an empty custom side open, and is null with no date filter', () => {
    expect(
      dateBounds(f({ date: 'custom', from: '2026-01-01' }), today),
    ).toEqual({ from: '2026-01-01', to: null })
    expect(dateBounds(f(), today)).toBeNull()
  })
})

describe('category picks', () => {
  it('picks a root whole, dropping a child picked alone, and unpicks it', () => {
    const on = toggleCategory(f({ subcategoryIds: [CAFES] }), DINING, catalog)
    expect(on).toMatchObject({ categoryIds: [DINING], subcategoryIds: [] })
    expect(toggleCategory(on, DINING, catalog)).toMatchObject({
      categoryIds: [],
      subcategoryIds: [],
    })
  })

  it('keeps the siblings when a child of a whole root is unticked', () => {
    const next = toggleSubcategory(f({ categoryIds: [DINING] }), CAFES, catalog)
    expect(next).toMatchObject({
      categoryIds: [],
      subcategoryIds: [RESTAURANTS],
    })
  })

  it('collapses into the root once every child is ticked', () => {
    const one = toggleSubcategory(f(), CAFES, catalog)
    expect(one.subcategoryIds).toEqual([CAFES])
    const both = toggleSubcategory(one, RESTAURANTS, catalog)
    expect(both).toMatchObject({ categoryIds: [DINING], subcategoryIds: [] })
  })

  it('leaves nothing for the root once its last child is unticked', () => {
    expect(
      toggleSubcategory(f({ subcategoryIds: [CAFES] }), CAFES, catalog),
    ).toMatchObject({ categoryIds: [], subcategoryIds: [] })
  })

  it('treats a root id handed to the child toggle as the root', () => {
    expect(toggleSubcategory(f(), GROCERIES, catalog).categoryIds).toEqual([
      GROCERIES,
    ])
  })

  it('"All" picks the root whole and keeps it picked', () => {
    const all = pickWholeCategory(
      f({ subcategoryIds: [CAFES] }),
      DINING,
      catalog,
    )
    expect(all).toMatchObject({ categoryIds: [DINING], subcategoryIds: [] })
    expect(pickWholeCategory(all, DINING, catalog).categoryIds).toEqual([
      DINING,
    ])
  })
})

describe('toggleWallet', () => {
  it('adds and removes a wallet', () => {
    const on = toggleWallet(f(), 'w1')
    expect(on.walletIds).toEqual(['w1'])
    expect(toggleWallet(on, 'w1').walletIds).toEqual([])
  })
})
