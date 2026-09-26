import { Icon } from '#/components/icons/Icon'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'

type Props = {
  /** A root's or a child's id — a child draws its own icon. */
  categoryId: string
  size?: number
}

/** A category's icon, resolved live from the user's catalog. */
export function CategoryIcon({ categoryId, size = 19 }: Props) {
  const catalog = useCategoryCatalog()
  return <Icon id={catalog.get(categoryId).icon} size={size} />
}
