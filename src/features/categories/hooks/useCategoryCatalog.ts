import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, localDbGeneration } from '#/db/db'
import { buildCatalog } from '#/features/categories/data/catalog'
import type { CategoryCatalog } from '#/features/categories/data/catalog'

const EMPTY = buildCatalog([])

/**
 * Seeds a remount's first render so it doesn't flash empty while the query resolves — only
 * within the same local data, never across a sign-out.
 */
let lastRead = { generation: localDbGeneration(), catalog: EMPTY }

/**
 * The live catalog, and whether it holds anything yet. Every account has categories on the
 * server, so an empty table means they have not been pulled to this device yet.
 */
export function useCategoryCatalogState(): {
  catalog: CategoryCatalog
  loaded: boolean
} {
  const rows = useLiveQuery(() => db.categories.toArray())
  const catalog = useMemo(() => {
    const generation = localDbGeneration()
    if (!rows) {
      return lastRead.generation === generation ? lastRead.catalog : EMPTY
    }
    lastRead = { generation, catalog: buildCatalog(rows) }
    return lastRead.catalog
  }, [rows])
  return { catalog, loaded: catalog.all.length > 0 }
}

/** The live two-level catalog. Cheap: a few dozen rows, rebuilt only when the table writes. */
export function useCategoryCatalog(): CategoryCatalog {
  return useCategoryCatalogState().catalog
}
