import { Icon } from '#/components/icons/Icon'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'

type Props = {
  categoryId: string
  /** When the row names a child, the child's own icon is the more specific thing to draw. */
  subcategoryId?: string | null
  size?: number
}

/** A category's icon, resolved live from the user's catalog. */
export function CategoryIcon({
  categoryId,
  subcategoryId = null,
  size = 19,
}: Props) {
  const catalog = useCategoryCatalog()
  const sub = catalog.sub(categoryId, subcategoryId)

  return <Icon id={sub?.icon ?? catalog.get(categoryId).icon} size={size} />
}
