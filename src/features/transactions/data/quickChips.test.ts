import { describe, expect, it } from 'vitest'
import {
  catId,
  defaultCatalog,
} from '#/features/categories/__fixtures__/categories'
import { quickChips } from './quickChips'

const catalog = defaultCatalog()
const FROM = '2026-06-01'

/** A row filed under the default catalog's `slug` (under `parentSlug` for a child). */
const row = (
  slug: string | null,
  parentSlug: string | null = null,
  over: Partial<{
    type: 'spend' | 'income'
    amount: number
    currency: string
    date: string
    deleted: 0 | 1
  }> = {},
) => ({
  type: 'spend' as const,
  amount: 1000,
  currency: 'USD',
  categoryId: slug === null ? null : catId(slug, parentSlug ?? undefined),
  date: '2026-09-01',
  deleted: 0 as const,
  ...over,
})

const firstSpend = catalog.byType('spend').map((c) => c.id)
const ids = (chips: ReadonlyArray<{ categoryId: string }>) =>
  chips.map((c) => c.categoryId)

describe('quickChips', () => {
  it('falls back to the first categories of the type when there is no history', () => {
    expect(
      quickChips({ rows: [], type: 'spend', catalog, from: FROM }),
    ).toEqual(firstSpend.slice(0, 4).map((categoryId) => ({ categoryId })))
  })

  it('ranks by uses, then by the latest use, and keeps subcategories', () => {
    const rows = [
      row('cafes', 'dining'),
      row('cafes', 'dining'),
      row('transport', null, { date: '2026-09-02' }),
      row('groceries', null, { date: '2026-08-01' }),
    ]
    const chips = quickChips({ rows, type: 'spend', catalog, from: FROM })
    expect(ids(chips.slice(0, 3))).toEqual([
      catId('cafes', 'dining'),
      catId('transport'),
      catId('groceries'),
    ])
    expect(chips).toHaveLength(4)
  })

  it('tops up without repeating a frequent parent', () => {
    const chips = quickChips({
      rows: [{ ...row(null), categoryId: firstSpend[0] }],
      type: 'spend',
      catalog,
      from: FROM,
    })
    expect(ids(chips)).toEqual(firstSpend.slice(0, 4))
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

  describe('with a typed amount', () => {
    const AMOUNT = { minor: 2500, currency: 'USD', from: '2026-08-27' }
    const frequentRows = [
      row('dining'),
      row('dining'),
      row('dining'),
      row('transport'),
      row('transport'),
      row('groceries'),
    ]

    it('leads with every category that amount was filed under, then the frequent ones', () => {
      const rows = [
        ...frequentRows,
        row('shopping', null, { amount: 2500 }),
        row('health', null, { amount: 2500, date: '2026-09-10' }),
        row('health', null, { amount: 2500, date: '2026-09-11' }),
      ]
      const chips = quickChips({
        rows,
        type: 'spend',
        catalog,
        from: FROM,
        amount: AMOUNT,
      })
      expect(ids(chips)).toEqual([
        catId('health'),
        catId('shopping'),
        catId('dining'),
        catId('transport'),
      ])
    })

    it('shows every match even past the usual count', () => {
      const matches = firstSpend.slice(0, 6)
      const rows = matches.map((categoryId) => ({
        ...row(null, null, { amount: 2500 }),
        categoryId,
      }))
      const chips = quickChips({
        rows,
        type: 'spend',
        catalog,
        from: FROM,
        amount: AMOUNT,
      })
      expect(ids(chips).sort()).toEqual([...matches].sort())
    })

    it('ignores another currency, another type, and matches older than the window', () => {
      const rows = [
        ...frequentRows,
        row('shopping', null, { amount: 2500, currency: 'EUR' }),
        row('health', null, { amount: 2500, date: '2026-08-01' }),
        row('salary', null, { amount: 2500, type: 'income' }),
      ]
      expect(
        quickChips({
          rows,
          type: 'spend',
          catalog,
          from: FROM,
          amount: AMOUNT,
        }),
      ).toEqual(quickChips({ rows, type: 'spend', catalog, from: FROM }))
    })
  })
})
