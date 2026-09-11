import { categoryOf } from '#/features/transactions/categories'

type Props = { categoryId: string; size?: number }

/** Renders a category's line icon (from the catalog) at the given size. */
export function CategoryIcon({ categoryId, size = 19 }: Props) {
  const Icon = categoryOf(categoryId).icon
  return <Icon size={size} strokeWidth={1.8} />
}
