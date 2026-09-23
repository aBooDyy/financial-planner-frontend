import { isIconId } from './catalog.gen'
import type { IconId } from './catalog.gen'

export const SPEND_CATEGORY_ICON: IconId = 'tag'
export const INCOME_CATEGORY_ICON: IconId = 'hand-deposit'
export const WALLET_ICON: IconId = 'wallet'
export const GROUP_ICON: IconId = 'stack'

export const CATEGORY_ICON_FALLBACK: Record<'spend' | 'income', IconId> = {
  spend: SPEND_CATEGORY_ICON,
  income: INCOME_CATEGORY_ICON,
}

// A stored id can outlive the pack that defined it — a hand-edited row, a regenerated or
// rolled-back manifest — so an unknown id resolves like a missing one rather than throwing.
export const iconIdOr = (
  id: string | null | undefined,
  fallback: IconId,
): IconId => (isIconId(id) ? id : fallback)
