import { describe, expect, it } from 'vitest'
import {
  catId,
  categoryRow as row,
  defaultCatalog,
} from '#/features/categories/__fixtures__/categories'
import { CATEGORIES } from './defaults'
import { DELETED_CATEGORY, DELETED_CATEGORY_ID, buildCatalog } from './catalog'

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
  it('is empty — not loaded — when there are no rows', () => {
    const catalog = buildCatalog([])

    expect(catalog.all).toEqual([])
    expect(catalog.fallbackFor('spend')).toBeNull()
    expect(catalog.get('anything')).toBe(DELETED_CATEGORY)
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
    expect(catalog.subsOf(dining.id).map((s) => s.slug)).toEqual([
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
    expect(catalog.subsOf(dining.id).map((s) => s.slug)).toEqual(['cafes'])
  })

  it('drops a child whose parent is missing', () => {
    const catalog = buildCatalog([
      dining,
      row({ id: 'orphan-id', slug: 'orphan', parentId: 'gone' }),
    ])

    expect(catalog.all.map((c) => c.slug)).toEqual(['dining'])
    expect(catalog.get('orphan-id')).toBe(DELETED_CATEGORY)
  })

  it('drops a child pointing at another child — never a third level', () => {
    const catalog = buildCatalog([
      dining,
      cafes,
      row({ id: 'deep-id', slug: 'deep', parentId: cafes.id }),
    ])

    expect(catalog.subsOf(dining.id).map((s) => s.slug)).toEqual(['cafes'])
    expect(catalog.get('deep-id')).toBe(DELETED_CATEGORY)
  })

  it('resolves a root and a child by id, each knowing its parent', () => {
    const catalog = buildCatalog([dining, cafes])

    expect(catalog.get(dining.id)).toMatchObject({
      name: 'Dining',
      parentId: null,
    })
    expect(catalog.get(cafes.id)).toMatchObject({
      name: 'Cafés',
      parentId: dining.id,
      type: 'spend',
    })
    expect(catalog.parentOf(cafes.id)?.id).toBe(dining.id)
    expect(catalog.parentOf(dining.id)).toBeNull()
    expect(catalog.rootOf(cafes.id).id).toBe(dining.id)
    expect(catalog.rootOf(dining.id).id).toBe(dining.id)
  })

  it('resolves an unknown id to one stable deleted entry', () => {
    const catalog = buildCatalog([dining, cafes])

    expect(catalog.get('gone')).toBe(catalog.get('also-gone'))
    expect(catalog.get('gone')).toMatchObject({
      id: DELETED_CATEGORY_ID,
      name: 'Deleted category',
      color: '#64748B',
      icon: 'tag',
    })
    expect(catalog.rootOf('gone')).toBe(DELETED_CATEGORY)
    expect(catalog.parentOf('gone')).toBeNull()
    expect(catalog.labelOf('gone')).toBe('Deleted category')
    expect(catalog.subsOf('gone')).toEqual([])
  })

  it('labels a root and a child', () => {
    const catalog = buildCatalog([dining, cafes])

    expect(catalog.labelOf(dining.id)).toBe('Dining')
    expect(catalog.labelOf(cafes.id)).toBe('Dining · Cafés')
    expect(catalog.pathOf(dining.id)).toEqual(['Dining'])
    expect(catalog.pathOf(cafes.id)).toEqual(['Dining', 'Cafés'])
  })

  it('lists no children for a child id', () => {
    expect(buildCatalog([dining, cafes]).subsOf(cafes.id)).toEqual([])
  })

  it('finds a root by slug, and a child only under its parent’s slug', () => {
    const catalog = buildCatalog([
      dining,
      cafes,
      row({ slug: 'cafes', name: 'Cafés (root)' }),
    ])

    expect(catalog.bySlug('dining')?.id).toBe(dining.id)
    expect(catalog.bySlug('cafes', 'dining')?.id).toBe(cafes.id)
    expect(catalog.bySlug('cafes')?.name).toBe('Cafés (root)')
    expect(catalog.bySlug('cafes', 'travel')).toBeNull()
    expect(catalog.bySlug('nope')).toBeNull()
  })

  it('falls back by type to the required roots, else the first root of the type', () => {
    const catalog = defaultCatalog()

    expect(catalog.fallbackFor('spend')?.id).toBe(catId('other'))
    expect(catalog.fallbackFor('income')?.id).toBe(catId('other_income'))

    const partial = buildCatalog([
      dining,
      row({ slug: 'salary', name: 'Salary', type: 'income' }),
    ])
    expect(partial.fallbackFor('spend')?.id).toBe(dining.id)
    expect(partial.fallbackFor('income')?.slug).toBe('salary')
  })

  it('inherits the parent’s colour for a child that has none', () => {
    const catalog = buildCatalog([dining, cafes])

    expect(catalog.get(cafes.id).color).toBe('#F59E0B')
  })

  it('gives a child with no icon the built-in one for its slug pair', () => {
    const catalog = buildCatalog([
      dining,
      row({ id: 'cafes-id', slug: 'cafes', parentId: dining.id, icon: null }),
    ])

    expect(catalog.get('cafes-id').icon).toBe('coffee')
  })

  it('falls back to the parent’s icon for a child the built-ins never named', () => {
    const catalog = buildCatalog([
      dining,
      row({ id: 'brunch-id', slug: 'brunch', parentId: dining.id, icon: null }),
    ])

    expect(catalog.get('brunch-id').icon).toBe('fork-knife')
  })

  it('gives a root with no icon the built-in one, then its type’s fallback', () => {
    const catalog = buildCatalog([
      row({ slug: 'dining', name: 'Eating out', icon: null }),
      row({ slug: 'yachts', name: 'Yachts', icon: null }),
      row({ slug: 'tips', name: 'Tips', type: 'income', icon: null }),
    ])

    expect(catalog.get(catId('dining')).icon).toBe('fork-knife')
    expect(catalog.get(catId('yachts')).icon).toBe('tag')
    expect(catalog.get(catId('tips')).icon).toBe('hand-deposit')
  })

  it('partitions by type', () => {
    const catalog = buildCatalog([
      dining,
      row({ slug: 'salary', name: 'Salary', type: 'income' }),
    ])

    expect(catalog.byType('spend').map((c) => c.slug)).toEqual(['dining'])
    expect(catalog.byType('income').map((c) => c.slug)).toEqual(['salary'])
  })

  it('resolves the seeded default rows to the whole built-in set', () => {
    const catalog = defaultCatalog()

    expect(catalog.all.map((c) => c.slug)).toEqual(CATEGORIES.map((c) => c.id))
    expect(catalog.labelOf(catId('cafes', 'dining'))).toBe('Dining · Cafés')
  })

  describe('classOf', () => {
    const transport = row({ slug: 'transport', spendClass: 'need' })
    const fuel = row({
      id: 'fuel-id',
      slug: 'fuel',
      parentId: transport.id,
    })
    const taxi = row({
      id: 'taxi-id',
      slug: 'taxi',
      parentId: transport.id,
      spendClass: 'want',
    })
    const other = row({ slug: 'other' })
    const salary = row({
      slug: 'salary',
      type: 'income',
      spendClass: 'need',
    })
    const catalog = buildCatalog([transport, fuel, taxi, other, salary])

    it('reads a root its own tag', () => {
      expect(catalog.classOf(transport.id)).toBe('need')
    })

    it('lets an untagged subcategory inherit its root', () => {
      expect(catalog.classOf('fuel-id')).toBe('need')
    })

    it('keeps a subcategory override', () => {
      expect(catalog.classOf('taxi-id')).toBe('want')
    })

    it('leaves an untagged root not sorted', () => {
      expect(catalog.classOf(other.id)).toBeNull()
    })

    it('never tags an income category or an unknown id', () => {
      expect(catalog.classOf(salary.id)).toBeNull()
      expect(catalog.classOf('missing')).toBeNull()
    })

    it('treats a row stored before the tag existed as untagged', () => {
      const legacy = { ...row({ slug: 'legacy' }) }
      delete legacy.spendClass
      expect(buildCatalog([legacy]).classOf(legacy.id)).toBeNull()
    })

    it('starts the seeded catalog on the defaults', () => {
      const seeded = defaultCatalog()
      expect(seeded.classOf(catId('cafes', 'dining'))).toBe('want')
      expect(seeded.classOf(catId('rent', 'housing'))).toBe('need')
      expect(seeded.classOf(catId('savings'))).toBe('saving')
      expect(seeded.classOf(catId('other'))).toBeNull()
    })
  })
})
