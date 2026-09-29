import type {
  CategoryCatalog,
  ResolvedCategory,
} from '#/features/categories/data/catalog'
import { useParentChoices } from '#/features/categories/hooks/useParentChoices'
import { ParentCategorySelect } from './ParentCategorySelect'

type Props = {
  id?: string
  categoryId: string
  value: string | null
  catalog: CategoryCatalog
  noneLabel: string
  onChange: (parent: ResolvedCategory | null) => void
}

/** An existing category's "In": where it may move, with why the rest is off. */
export function MoveParentSelect({ categoryId, catalog, ...rest }: Props) {
  const choices = useParentChoices(categoryId, catalog)
  if (choices === null) return null
  return (
    <ParentCategorySelect
      {...rest}
      options={choices.options}
      locked={choices.locked}
      blocked={choices.blocked}
    />
  )
}
