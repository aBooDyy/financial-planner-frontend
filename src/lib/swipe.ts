/** How far a finger must travel sideways, in px, before it counts as a swipe. */
const MIN_DISTANCE = 48

export type SwipeStep = -1 | 1

/**
 * The step a finger's travel asks for, or null for a tap, a scroll or a diagonal drag. Content
 * follows the finger, so dragging toward the reading start brings the next period in —
 * leftward in LTR, rightward in RTL.
 */
export const swipeStep = (
  dx: number,
  dy: number,
  rtl: boolean,
): SwipeStep | null => {
  if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) {
    return null
  }
  const towardStart = rtl ? dx > 0 : dx < 0
  return towardStart ? 1 : -1
}
