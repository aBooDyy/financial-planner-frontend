import { useState } from 'react'
import { packById } from '../data/packs'
import { useCategorySelection } from '../hooks/useCategorySelection'
import { useOnboardingDraft } from '../stores/onboardingDraft'
import { CategoryGroup } from './CategoryGroup'
import { PackPicker } from './PackPicker'
import { StepIntro } from './StepIntro'

export function CategoriesStep() {
  const { catalog, suggestedId, activeId, selected, customized } =
    useCategorySelection()
  const hasIntents = useOnboardingDraft((s) => s.intents.length > 0)
  const pickPack = useOnboardingDraft((s) => s.pickPack)
  const toggleCategory = useOnboardingDraft((s) => s.toggleCategory)
  const resetSelection = useOnboardingDraft((s) => s.resetSelection)
  const [peek, setPeek] = useState<string | null>(null)

  const selectedSet = new Set(selected)
  const toggle = (slug: string) => {
    if (selectedSet.has(slug) && peek === slug) setPeek(null)
    toggleCategory(slug, selected)
  }

  return (
    <>
      <StepIntro eyebrow="Categories" title="Here's a starting set for you">
        {hasIntents
          ? `Based on your goals, we suggest the ${packById(suggestedId).name} pack. Switch packs, or tap any category to add or remove it.`
          : 'Start with Essentials, or pick the pack that fits you best. Tap any category to add or remove it.'}
      </StepIntro>

      <PackPicker
        catalog={catalog}
        activeId={activeId}
        suggestedId={suggestedId}
        customized={customized}
        onPick={(id) => {
          setPeek(null)
          pickPack(id)
        }}
        onReset={resetSelection}
      />

      <CategoryGroup
        label="Spending"
        categories={catalog.byType('spend')}
        selected={selectedSet}
        peek={peek}
        onToggle={toggle}
        onPeek={setPeek}
      />
      <CategoryGroup
        label="Income"
        categories={catalog.byType('income')}
        selected={selectedSet}
        peek={peek}
        onToggle={toggle}
        onPeek={setPeek}
      />

      <p className="mt-[22px] text-[13px] text-fp-text-3">
        Savings and Other are always included — goal contributions and anything
        uncategorised land there. Add your own categories anytime in Settings.
      </p>
    </>
  )
}
