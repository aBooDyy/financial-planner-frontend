import { useCategoryCatalogState } from '#/features/categories/hooks/useCategoryCatalog'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'

/**
 * Whether a sheet's defaults can be read: every planner input and the category catalog have
 * loaded. Editors and sheets mount their body only then, so its first state is the real one.
 */
export function usePlanningReady(): boolean {
  const { loading } = usePlannedData()
  const { loaded } = useCategoryCatalogState()
  return !loading && loaded
}
