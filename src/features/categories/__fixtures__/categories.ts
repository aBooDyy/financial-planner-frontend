import type { LocalCategory } from '#/db/types'
import { buildCatalog } from '#/features/categories/data/catalog'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import {
  CATEGORIES,
  defaultSpendClass,
} from '#/features/categories/data/defaults'

/** The id a fixture row gets: `cat-dining`, `cat-dining-cafes`. */
export const catId = (slug: string, parentSlug?: string): string =>
  parentSlug ? `cat-${parentSlug}-${slug}` : `cat-${slug}`

const STAMP = '2026-01-01T00:00:00.000Z'

/** One local category row, synced and clean unless overridden. */
export const categoryRow = (
  over: Partial<LocalCategory> & { slug: string },
): LocalCategory => ({
  id: catId(over.slug),
  parentId: null,
  name: over.slug,
  type: 'spend',
  color: '#1F9D6B',
  icon: null,
  spendClass: null,
  position: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
  version: 'v1',
  dirty: 0,
  deleted: 0,
  ...over,
})

/** The rows a freshly seeded account holds: the built-in catalog, ids from `catId`. */
export const defaultCategoryRows = (): LocalCategory[] =>
  CATEGORIES.flatMap((c, i) => [
    categoryRow({
      slug: c.id,
      name: c.name,
      type: c.type,
      color: c.color,
      spendClass: c.type === 'spend' ? defaultSpendClass(c.id) : null,
      position: i,
    }),
    ...c.subs.map((s, j) =>
      categoryRow({
        id: catId(s.id, c.id),
        parentId: catId(c.id),
        slug: s.id,
        name: s.name,
        type: c.type,
        color: '',
        position: j,
      }),
    ),
  ])

/** The catalog a freshly seeded account resolves to. */
export const defaultCatalog = (): CategoryCatalog =>
  buildCatalog(defaultCategoryRows())
