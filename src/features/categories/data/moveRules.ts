import type { CategoryCatalog, ResolvedCategory } from './catalog'
import { isRequiredCategory } from './required'

export type MovingCategory = {
  id: string
  /** Where it sits now, not where the draft has it. */
  parentId: string | null
  slug: string
  name: string
  type: ResolvedCategory['type']
}

/** The top level's key in `blocked`. */
export const TOP_LEVEL = null

export type ParentChoices = {
  /** Why it can't move at all. */
  locked: string | null
  /** The categories it could sit under: its own type, never itself. */
  options: ResolvedCategory[]
  /** Why it can't go under a parent (by id, or `TOP_LEVEL`); absent when it can. */
  blocked: ReadonlyMap<string | null, string>
}

/**
 * Where a category may move, mirroring the server's refusals so the editor never offers a
 * move its push would bounce. A root that would become a subcategory is `locked` by its own
 * state; a destination is `blocked` when a sibling there already holds its slug.
 */
export function parentChoices(
  catalog: CategoryCatalog,
  moving: MovingCategory,
  hasBudget: boolean,
): ParentChoices {
  const roots = catalog.all.filter((c) => c.id !== moving.id)
  const options = roots.filter((c) => c.type === moving.type)
  const twinIn = (
    siblings: ReadonlyArray<{ id: string; slug: string; name: string }>,
  ) => siblings.find((c) => c.slug === moving.slug && c.id !== moving.id)

  const blocked = new Map<string | null, string>()
  const topTwin = twinIn(roots)
  if (topTwin) {
    blocked.set(
      TOP_LEVEL,
      `There’s already a top-level category called “${topTwin.name}”.`,
    )
  }
  for (const root of options) {
    const twin = twinIn(root.subs)
    if (twin) {
      blocked.set(
        root.id,
        `${root.name} already has a subcategory called “${twin.name}”.`,
      )
    }
  }

  return {
    locked: lockedReason(catalog, moving, hasBudget),
    options,
    blocked,
  }
}

function lockedReason(
  catalog: CategoryCatalog,
  moving: MovingCategory,
  hasBudget: boolean,
): string | null {
  if (moving.parentId !== null) return null
  if (isRequiredCategory(moving)) {
    return `${moving.name} is built in, so it stays a top-level category.`
  }
  if (catalog.subsOf(moving.id).length > 0) {
    return `${moving.name} has subcategories, and only two levels are allowed. Move or delete its subcategories first.`
  }
  if (hasBudget) {
    return `${moving.name} has a budget, and budgets are set on top-level categories only. Remove its budget first.`
  }
  return null
}
