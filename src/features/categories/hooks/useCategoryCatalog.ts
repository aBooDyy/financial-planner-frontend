import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { buildCatalog } from '#/features/categories/data/catalog'
import type { CategoryCatalog } from '#/features/categories/data/catalog'

/** The live two-level catalog. Cheap: a few dozen rows, rebuilt only when the table writes. */
export function useCategoryCatalog(): CategoryCatalog {
  const rows = useLiveQuery(() => db.categories.toArray())
  return useMemo(() => buildCatalog(rows ?? []), [rows])
}
