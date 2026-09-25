import { useMemo } from 'react'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { isCustomized, packSelection, suggestedPackId } from '../data/packs'
import type { PackId } from '../data/packs'
import { useOnboardingDraft } from '../stores/onboardingDraft'

export type CategorySelection = {
  catalog: CategoryCatalog
  suggestedId: PackId
  activeId: PackId
  /** Selected top-level slugs, limited to the ones the catalog actually has. */
  selected: string[]
  customized: boolean
}

/** The categories the draft currently keeps: the active pack, or the user's edit of it. */
export function useCategorySelection(): CategorySelection {
  const catalog = useCategoryCatalog()
  const intents = useOnboardingDraft((s) => s.intents)
  const packId = useOnboardingDraft((s) => s.packId)
  const edited = useOnboardingDraft((s) => s.selection)

  return useMemo(() => {
    const suggestedId = suggestedPackId(intents)
    const activeId = packId ?? suggestedId
    const roots = new Set(catalog.all.map((c) => c.slug))
    const selected = (edited ?? packSelection(activeId)).filter((s) =>
      roots.has(s),
    )
    return {
      catalog,
      suggestedId,
      activeId,
      selected,
      customized: edited !== null && isCustomized(edited, activeId),
    }
  }, [catalog, intents, packId, edited])
}
