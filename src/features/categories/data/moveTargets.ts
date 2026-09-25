import type { TxType } from '#/features/transactions/api/types'
import type { IconId } from '#/lib/icons/catalog.gen'
import type { CategoryCatalog } from './catalog'

/** A category a deleted one's rows can move into. */
export type MoveTarget = {
  id: string
  name: string
  /** "Dining › Cafés" for a subcategory, the plain name for a category. */
  label: string
  /** The parent's name for a subcategory, `null` for a category. */
  parentName: string | null
  color: string
  icon: IconId
}

type Deleting = { id: string; type: TxType }

/**
 * Every category that survives deleting `deleting` and shares its type, each followed by
 * its subcategories. Deleting a category takes its children with it, so none of them can
 * receive its rows; deleting a subcategory leaves its parent and siblings as candidates.
 */
export function moveTargetsFor(
  catalog: CategoryCatalog,
  deleting: Deleting,
): MoveTarget[] {
  const out: MoveTarget[] = []
  for (const c of catalog.byType(deleting.type)) {
    if (c.id === deleting.id) continue
    out.push({
      id: c.id,
      name: c.name,
      label: c.name,
      parentName: null,
      color: c.color,
      icon: c.icon,
    })
    for (const s of c.subs) {
      if (s.id === deleting.id) continue
      out.push({
        id: s.id,
        name: s.name,
        label: `${c.name} › ${s.name}`,
        parentName: c.name,
        color: s.color,
        icon: s.icon,
      })
    }
  }
  return out
}

const FALLBACK_SLUG = 'other'

/**
 * The target a delete suggests before the user picks: a subcategory's rows go back to its
 * parent, a category's to the catch-all "Other", else to the first category left.
 */
export function defaultMoveTarget(
  catalog: CategoryCatalog,
  targets: ReadonlyArray<MoveTarget>,
  parentId: string | null,
): string | null {
  const ids = new Set(targets.map((t) => t.id))
  if (parentId && ids.has(parentId)) return parentId
  const other = catalog.all.find(
    (c) => c.slug === FALLBACK_SLUG && ids.has(c.id),
  )
  if (other) return other.id
  return (
    targets.find((t) => t.parentName === null)?.id ?? targets.at(0)?.id ?? null
  )
}
