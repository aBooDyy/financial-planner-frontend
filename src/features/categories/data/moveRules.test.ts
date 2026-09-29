import { describe, expect, it } from 'vitest'
import {
  catId,
  categoryRow,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import { buildCatalog } from './catalog'
import type { CategoryCatalog } from './catalog'
import { parentChoices } from './moveRules'

const catalogOf = (...extra: Parameters<typeof categoryRow>[0][]) =>
  buildCatalog([...defaultCategoryRows(), ...extra.map(categoryRow)])

const choicesFor = (catalog: CategoryCatalog, id: string, hasBudget = false) =>
  parentChoices(catalog, catalog.get(id), hasBudget)

describe('parentChoices', () => {
  it('offers the top level and every other root of the same type', () => {
    const catalog = catalogOf()
    const { locked, options, blocked } = choicesFor(
      catalog,
      catId('cafes', 'dining'),
    )

    expect(locked).toBeNull()
    expect(blocked.size).toBe(0)
    expect(options.map((c) => c.id)).toContain(catId('groceries'))
    expect(options.every((c) => c.type === 'spend')).toBe(true)
  })

  it('never offers a category as its own parent', () => {
    const catalog = catalogOf({ slug: 'garden' })
    const { options } = choicesFor(catalog, catId('garden'))

    expect(options.map((c) => c.id)).not.toContain(catId('garden'))
  })

  it('blocks a parent whose subcategories already hold the slug', () => {
    const catalog = catalogOf()
    const { blocked } = choicesFor(catalog, catId('maintenance', 'housing'))

    expect(blocked.get(catId('transport'))).toMatch(
      /Transport already has a subcategory called/,
    )
    expect(blocked.has(catId('housing'))).toBe(false)
  })

  it('blocks the top level when a root of either type holds the slug', () => {
    const catalog = catalogOf({
      id: 'cat-bonus-root',
      slug: 'interest',
      name: 'Interest',
      type: 'income',
    })
    const { blocked } = choicesFor(catalog, catId('interest', 'debt'))

    expect(blocked.get(null)).toMatch(/top-level category called “Interest”/)
  })

  it('locks a root with subcategories', () => {
    const { locked } = choicesFor(catalogOf(), catId('dining'))

    expect(locked).toMatch(/has subcategories/)
  })

  it('locks a built-in root', () => {
    const { locked } = choicesFor(catalogOf(), catId('other'))

    expect(locked).toMatch(/built in/)
  })

  it('locks a root with a budget', () => {
    const catalog = catalogOf({ slug: 'garden', name: 'Garden' })

    expect(choicesFor(catalog, catId('garden'), true).locked).toMatch(
      /has a budget/,
    )
    expect(choicesFor(catalog, catId('garden')).locked).toBeNull()
  })

  it('never locks a subcategory, even with a budget flag', () => {
    const { locked } = choicesFor(catalogOf(), catId('cafes', 'dining'), true)

    expect(locked).toBeNull()
  })
})
