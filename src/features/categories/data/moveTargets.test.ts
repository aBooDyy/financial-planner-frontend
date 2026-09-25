import { describe, expect, it } from 'vitest'
import type { LocalCategory } from '#/db/types'
import { buildCatalog } from './catalog'
import { defaultMoveTarget, moveTargetsFor } from './moveTargets'

const row = (id: string, over: Partial<LocalCategory> = {}): LocalCategory => ({
  id,
  parentId: null,
  slug: id,
  name: id,
  type: 'spend',
  color: '#1F9D6B',
  icon: null,
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
  ...over,
})

const catalog = buildCatalog([
  row('dining', { position: 0 }),
  row('cafes', { parentId: 'dining' }),
  row('takeaway', { parentId: 'dining', position: 1 }),
  row('groceries', { position: 1 }),
  row('bakery', { parentId: 'groceries' }),
  row('other', { position: 2 }),
  row('salary', { type: 'income' }),
])

const ids = (deleting: { id: string; type: 'spend' | 'income' }) =>
  moveTargetsFor(catalog, deleting).map((t) => t.id)

describe('moveTargetsFor', () => {
  it('drops a deleted category together with the children it takes along', () => {
    expect(ids({ id: 'dining', type: 'spend' })).toEqual([
      'groceries',
      'bakery',
      'other',
    ])
  })

  it('keeps the parent and siblings of a deleted subcategory', () => {
    expect(ids({ id: 'cafes', type: 'spend' })).toEqual([
      'dining',
      'takeaway',
      'groceries',
      'bakery',
      'other',
    ])
  })

  it('offers only categories of the same type', () => {
    expect(ids({ id: 'nothing', type: 'income' })).toEqual(['salary'])
  })

  it('names a subcategory with its parent', () => {
    const bakery = moveTargetsFor(catalog, { id: 'dining', type: 'spend' })[1]
    expect(bakery).toMatchObject({
      label: 'groceries › bakery',
      parentName: 'groceries',
    })
  })
})

describe('defaultMoveTarget', () => {
  const suggest = (id: string, parentId: string | null) =>
    defaultMoveTarget(
      catalog,
      moveTargetsFor(catalog, { id, type: 'spend' }),
      parentId,
    )

  it('sends a subcategory’s rows back to its parent', () => {
    expect(suggest('cafes', 'dining')).toBe('dining')
  })

  it('sends a category’s rows to “Other”', () => {
    expect(suggest('dining', null)).toBe('other')
  })

  it('falls back to the first category left when “Other” is the one going', () => {
    expect(suggest('other', null)).toBe('dining')
  })

  it('suggests nothing when nothing is left', () => {
    expect(defaultMoveTarget(catalog, [], null)).toBeNull()
  })
})
