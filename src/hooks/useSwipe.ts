import { useRef } from 'react'
import type { TouchEvent } from 'react'
import { useDirectionStore } from '#/stores/direction'

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

/** Touch handlers that turn a sideways swipe into a step back (-1) or forward (1). */
export function useSwipe(onStep: (step: SwipeStep) => void) {
  const rtl = useDirectionStore((s) => s.direction === 'rtl')
  const start = useRef<{ x: number; y: number } | null>(null)

  return {
    onTouchStart: (e: TouchEvent) => {
      const touch = e.touches[0]
      start.current =
        e.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null
    },
    onTouchEnd: (e: TouchEvent) => {
      const from = start.current
      start.current = null
      const touch = e.changedTouches[0] as Touch | undefined
      if (from === null || touch === undefined) return
      const step = swipeStep(
        touch.clientX - from.x,
        touch.clientY - from.y,
        rtl,
      )
      if (step !== null) onStep(step)
    },
    onTouchCancel: () => {
      start.current = null
    },
  }
}
