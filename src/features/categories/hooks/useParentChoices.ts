import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { parentChoices } from '#/features/categories/data/moveRules'
import type { ParentChoices } from '#/features/categories/data/moveRules'

/** Where the category `id` may move; `null` while its row or its budgets are loading. */
export function useParentChoices(
  id: string,
  catalog: CategoryCatalog,
): ParentChoices | null {
  const budgets = useLiveQuery(
    () =>
      db.budgets.filter((b) => b.deleted === 0 && b.categoryId === id).count(),
    [id],
  )
  if (budgets === undefined || !catalog.has(id)) return null
  const self = catalog.get(id)
  return parentChoices(catalog, self, budgets > 0)
}
