import { createBill } from '#/features/bills/data/mutations'
import { createGoal } from '#/features/goals/data/mutations'
import type { WhatIfItem } from '#/features/planning/data/whatIf'
import { useWhatIf } from '#/features/planning/stores/whatIf'
import { saveEveryday } from './everyday'

/** Makes a tried item real, the same as adding it from its editor, and stops trying it. */
export async function addTryoutToPlan(item: WhatIfItem): Promise<void> {
  if (item.kind === 'bill') await createBill(item.draft)
  else if (item.kind === 'goal') await createGoal(item.draft)
  else await saveEveryday(null, item.draft)
  useWhatIf.getState().remove(item.id)
}
