import { describe, expect, it } from 'vitest'
import type { LocalMerchant, LocalTransaction } from '#/db/types'
import {
  catId,
  defaultCatalog,
} from '#/features/categories/__fixtures__/categories'
import { rankMerchantCategories } from './categorySuggestions'

const catalog = defaultCatalog()

const MERCHANT = {
  id: 'm1',
  displayName: 'Carrefour',
  learnedCategoryId: null,
  deleted: 0,
} as LocalMerchant

const tx = (
  categoryId: string,
  date: string,
  over: Partial<LocalTransaction> = {},
) =>
  ({
    merchantId: 'm1',
    categoryId,
    date,
    deleted: 0,
    ...over,
  }) as LocalTransaction

describe('rankMerchantCategories', () => {
  it('puts the last choice first, then the rest by use, the later one breaking a tie', () => {
    const ranked = rankMerchantCategories(
      { ...MERCHANT, learnedCategoryId: catId('shopping') },
      [
        tx(catId('dining'), '2026-09-01'),
        tx(catId('groceries'), '2026-09-02'),
        tx(catId('groceries'), '2026-09-03'),
        tx(catId('health'), '2026-09-10'),
        tx(catId('shopping'), '2026-09-20'),
      ],
      catalog,
    )

    expect(ranked).toEqual([
      catId('shopping'),
      catId('groceries'),
      catId('health'),
      catId('dining'),
    ])
  })

  it('skips deleted entries, other merchants and categories the catalog lacks', () => {
    const ranked = rankMerchantCategories(
      { ...MERCHANT, learnedCategoryId: 'gone' },
      [
        tx(catId('dining'), '2026-09-01', { deleted: 1 }),
        tx(catId('health'), '2026-09-01', { merchantId: 'm2' }),
        tx(catId('groceries'), '2026-09-01'),
      ],
      catalog,
    )

    expect(ranked).toEqual([catId('groceries')])
  })
})
