import { useCategoryCatalogState } from '#/features/categories/hooks/useCategoryCatalog'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'

/**
 * Whether an editor's defaults can be read: the planner's inputs and the category catalog
 * have loaded. Editors mount their form only then, so its first state is the real one.
 */
export function useEditorReady(): boolean {
  const { loading } = usePlannedData()
  const { loaded } = useCategoryCatalogState()
  return !loading && loaded
}
