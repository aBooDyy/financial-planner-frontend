import {
  SPEND_CLASS_FILL,
  UNSORTED_FILL,
} from '#/features/categories/spendClass'
import type { NwsSegmentKey } from '#/features/reports/data/needsWantsCard'

/** Every part of the Needs, wants, savings bar, the excess in the danger colour. */
export const SEGMENT_FILL: Record<NwsSegmentKey, string> = {
  ...SPEND_CLASS_FILL,
  unsorted: UNSORTED_FILL,
  overspent: 'bg-fp-danger',
}
