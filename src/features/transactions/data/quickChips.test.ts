import { describe, expect, it } from 'vitest'
import { buildCatalog } from '#/features/categories/data/catalog'
import { quickChips } from './quickChips'

const catalog = buildCatalog([])
const FROM = '2026-06-01'

const row = (
  category: string | null,
  subcategory: string | null = null,
  over: Partial<{
    type: 'spend' | 'income'
    date: string
    deleted: 0 | 1
  }> = {},
) => ({
  type: 'spend' as const,
  category,
  subcategory,
  date: '2026-09-01',
  deleted: 0 as const,
  ...over,
})

const firstSpend = catalog.byType('spend').map((c) => c.slug)

describe('quickChips', () => {
  it('falls back to the first categories of the type when there is no history', () => {
    expect(
      quickChips({ rows: [], type: 'spend', catalog, from: FROM }),
    ).toEqual(
      firstSpend
        .slice(0, 4)
        .map((category) => ({ category, subcategory: null })),
    )
  })

  it('ranks by uses, then by the latest use, and keeps subcategories', () => {
    const rows = [
      row('dining', 'cafes'),
      row('dining', 'cafes'),
      row('transport', null, { date: '2026-09-02' }),
      row('groceries', null, { date: '2026-08-01' }),
    ]
    const chips = quickChips({ rows, type: 'spend', catalog, from: FROM })
    expect(chips.slice(0, 3)).toEqual([
      { category: 'dining', subcategory: 'cafes' },
      { category: 'transport', subcategory: null },
      { category: 'groceries', subcategory: null },
    ])
    expect(chips).toHaveLength(4)
  })

  it('tops up without repeating a frequent parent', () => {
    const chips = quickChips({
      rows: [row(firstSpend[0])],
      type: 'spend',
      catalog,
      from: FROM,
    })
    expect(chips.map((c) => c.category)).toEqual(firstSpend.slice(0, 4))
  })

  it('ignores other types, deleted, stale, and unknown categories', () => {
    const rows = [
      row('salary', null, { type: 'income' }),
      row('dining', null, { deleted: 1 }),
      row('dining', null, { date: '2026-01-01' }),
      row('no-such-category'),
      row(null),
    ]
    expect(quickChips({ rows, type: 'spend', catalog, from: FROM })).toEqual(
      quickChips({ rows: [], type: 'spend', catalog, from: FROM }),
    )
  })
})
