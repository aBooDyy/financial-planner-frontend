import { describe, expect, it } from 'vitest'
import type { LocalCategory } from '#/db/types'
import { CATEGORIES } from './defaults'
import { buildCatalog } from './catalog'

let seq = 0

const row = (
  over: Partial<LocalCategory> & { slug: string },
): LocalCategory => {
  seq += 1
  return {
    id: over.slug,
    parentId: null,
    name: over.slug,
    type: 'spend',
    color: '#1F9D6B',
    icon: null,
    position: 0,
    createdAt: `2026-01-01T00:00:0${seq % 10}.000Z`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 'v1',
    dirty: 0,
    deleted: 0,
    ...over,
  }
}

const dining = row({
  slug: 'dining',
  name: 'Dining',
  color: '#F59E0B',
  icon: 'fork-knife',
  position: 1,
})

const cafes = row({
  id: 'cafes-id',
  slug: 'cafes',
  name: 'Cafés',
  parentId: dining.id,
  color: '',
  icon: 'coffee',
  position: 0,
})

describe('buildCatalog', () => {
  it('yields the built-in defaults when there are no rows', () => {
    const catalog = buildCatalog([])

    expect(catalog.all).toHaveLength(CATEGORIES.length)
    expect(catalog.get('dining').name).toBe('Dining')
    expect(catalog.subsOf('dining').map((s) => s.slug)).toEqual([
      'restaurants',
      'cafes',
      'takeaway',
      'snacks',
    ])
  })

  it('nests children under roots, each level ordered by position', () => {
    const catalog = buildCatalog([
      row({ slug: 'travel', name: 'Travel', position: 2 }),
      dining,
      row({ slug: 'groceries', name: 'Groceries', position: 0 }),
      row({
        id: 'takeaway-id',
        slug: 'takeaway',
        parentId: dining.id,
        position: 1,
      }),
      cafes,
    ])

    expect(catalog.all.map((c) => c.slug)).toEqual([
      'groceries',
      'dining',
      'travel',
    ])
    expect(catalog.subsOf('dining').map((s) => s.slug)).toEqual([
      'cafes',
      'takeaway',
    ])
  })

  it('excludes deleted rows at both levels', () => {
    const catalog = buildCatalog([
      dining,
      row({ slug: 'travel', name: 'Travel', deleted: 1 }),
      cafes,
      row({
        id: 'takeaway-id',
        slug: 'takeaway',
        parentId: dining.id,
        deleted: 1,
      }),
    ])

    expect(catalog.all.map((c) => c.slug)).toEqual(['dining'])
    expect(catalog.subsOf('dining').map((s) => s.slug)).toEqual(['cafes'])
  })

  it('drops a child whose parent is missing', () => {
    const catalog = buildCatalog([
      dining,
      row({ id: 'orphan-id', slug: 'orphan', parentId: 'gone' }),
    ])

    expect(catalog.all.map((c) => c.slug)).toEqual(['dining'])
    expect(catalog.subsOf('dining')).toEqual([])
  })

  it('drops a child pointing at another child — never a third level', () => {
    const catalog = buildCatalog([
      dining,
      cafes,
      row({ id: 'deep-id', slug: 'deep', parentId: cafes.id }),
    ])

    expect(catalog.all.map((c) => c.slug)).toEqual(['dining'])
    expect(catalog.subsOf('dining').map((s) => s.slug)).toEqual(['cafes'])
  })

  it('resolves an unknown slug against the built-ins first', () => {
    const catalog = buildCatalog([dining, cafes])

    expect(catalog.get('travel')).toMatchObject({
      slug: 'travel',
      name: 'Travel',
      icon: 'suitcase-rolling',
    })
  })

  it('falls back to a generic Other for a slug nothing knows', () => {
    const catalog = buildCatalog([dining, cafes])

    expect(catalog.get('gone_for_good').name).toBe('Other')
  })

  it('prefers the user’s own Other row over the built-in one', () => {
    const catalog = buildCatalog([
      dining,
      row({ slug: 'other', name: 'Miscellaneous' }),
    ])

    expect(catalog.get('gone_for_good').name).toBe('Miscellaneous')
  })

  it('returns null for a null subcategory rather than throwing', () => {
    expect(buildCatalog([dining, cafes]).sub('dining', null)).toBeNull()
  })

  it('labels a row with and without a subcategory', () => {
    const catalog = buildCatalog([dining, cafes])

    expect(catalog.labelOf('dining', null)).toBe('Dining')
    expect(catalog.labelOf('dining', 'cafes')).toBe('Dining · Cafés')
  })

  it('inherits the parent’s colour for a child that has none', () => {
    const catalog = buildCatalog([dining, cafes])

    expect(catalog.sub('dining', 'cafes')?.color).toBe('#F59E0B')
  })

  it('gives a child with no icon the built-in one for its slug', () => {
    const catalog = buildCatalog([
      dining,
      row({ id: 'cafes-id', slug: 'cafes', parentId: dining.id, icon: null }),
    ])

    expect(catalog.sub('dining', 'cafes')?.icon).toBe('coffee')
  })

  it('falls back to the parent’s icon for a child the built-ins never named', () => {
    const catalog = buildCatalog([
      dining,
      row({ id: 'brunch-id', slug: 'brunch', parentId: dining.id, icon: null }),
    ])

    expect(catalog.sub('dining', 'brunch')?.icon).toBe('fork-knife')
  })

  it('gives a root with no icon the built-in one, then its type’s fallback', () => {
    const catalog = buildCatalog([
      row({ slug: 'dining', name: 'Eating out', icon: null }),
      row({ slug: 'yachts', name: 'Yachts', icon: null }),
      row({ slug: 'tips', name: 'Tips', type: 'income', icon: null }),
    ])

    expect(catalog.get('dining').icon).toBe('fork-knife')
    expect(catalog.get('yachts').icon).toBe('tag')
    expect(catalog.get('tips').icon).toBe('hand-deposit')
  })

  it('still labels a deleted built-in child from the defaults', () => {
    const catalog = buildCatalog([dining])

    expect(catalog.labelOf('dining', 'cafes')).toBe('Dining · Cafés')
    expect(catalog.sub('dining', 'unheard_of')).toBeNull()
  })

  it('partitions by type', () => {
    const catalog = buildCatalog([
      dining,
      row({ slug: 'salary', name: 'Salary', type: 'income' }),
    ])

    expect(catalog.byType('spend').map((c) => c.slug)).toEqual(['dining'])
    expect(catalog.byType('income').map((c) => c.slug)).toEqual(['salary'])
  })
})
