import { describe, expect, it } from 'vitest'
import {
  CAFES,
  CARD,
  DINING,
  MAIN,
  NODES,
  catalog,
} from './__fixtures__/search'
import { activeFilterChips } from './chips'
import { EMPTY_SEARCH_FILTERS } from './types'
import type { SearchFilters } from './types'

const f = (over: Partial<SearchFilters> = {}): SearchFilters => ({
  ...EMPTY_SEARCH_FILTERS,
  ...over,
})

const chipsOf = (filters: SearchFilters) =>
  activeFilterChips(filters, {
    catalog,
    nodes: NODES,
    base: 'EUR',
    dateFormat: 'dmy',
  })

const labels = (filters: SearchFilters) => chipsOf(filters).map((c) => c.label)

describe('activeFilterChips', () => {
  it('is empty with no filter set', () => {
    expect(chipsOf(f())).toEqual([])
  })

  it('labels every kind of filter', () => {
    expect(
      labels(
        f({
          type: 'spend',
          date: '30',
          categoryIds: [DINING],
          subcategoryIds: [CAFES],
          walletIds: [MAIN.id, CARD.id],
          min: '10',
          max: '50',
        }),
      ),
    ).toEqual([
      'Spending',
      'Last 30 days',
      'Dining',
      'Dining › Cafés',
      'Main · Personal',
      'Travel card',
      '€10 – €50',
    ])
  })

  it.each<[Partial<SearchFilters>, string]>([
    [{ date: 'month' }, 'This month'],
    [{ date: '90' }, 'Last 90 days'],
    [
      { date: 'custom', from: '2026-09-01', to: '2026-09-15' },
      '01/09/2026 – 15/09/2026',
    ],
    [{ date: 'custom', to: '2026-09-15' }, 'Any – 15/09/2026'],
    [{ date: 'custom', from: '2026-09-01' }, '01/09/2026 – now'],
  ])('labels the date filter %o as %s', (over, label) => {
    expect(labels(f(over))).toEqual([label])
  })

  it('labels income and an open amount side', () => {
    expect(labels(f({ type: 'income' }))).toEqual(['Income'])
    expect(labels(f({ max: '50' }))).toEqual(['Any – €50'])
    expect(labels(f({ min: '10.5' }))).toEqual(['€10.50 – any'])
  })

  it('removes only its own filter', () => {
    const filters = f({
      type: 'income',
      date: 'custom',
      from: '2026-09-01',
      categoryIds: [DINING],
      subcategoryIds: [CAFES],
      walletIds: [MAIN.id, CARD.id],
      min: '1',
      max: '2',
    })
    const byKey = new Map(chipsOf(filters).map((c) => [c.key, c]))
    const removed = (key: string) => byKey.get(key)?.remove(filters)
    expect(removed('type')?.type).toBe('any')
    expect(removed('date')).toMatchObject({ date: 'any', from: '', to: '' })
    expect(removed(`category:${DINING}`)?.categoryIds).toEqual([])
    expect(removed(`subcategory:${CAFES}`)?.subcategoryIds).toEqual([])
    expect(removed(`wallet:${MAIN.id}`)?.walletIds).toEqual([CARD.id])
    expect(removed('amount')).toMatchObject({
      min: '',
      max: '',
      type: 'income',
    })
  })
})
