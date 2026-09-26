import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

const MOVE: KeyframeAnimationOptions = {
  duration: 280,
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
}
const ENTER: KeyframeAnimationOptions = {
  duration: 220,
  easing: 'ease-out',
}

type Spot = { x: number; y: number }

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Slides the `[data-flip-key]` elements inside the returned ref from where they last sat to
 * where each render puts them, and fades newcomers in. The container must be their offset
 * parent (e.g. `relative`) so layout positions can be read without the running transforms.
 */
export function useFlipLayout<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)
  const spots = useRef<Map<string, Spot> | null>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const box = root.getBoundingClientRect()
    const before = spots.current
    const after = new Map<string, Spot>()
    const animate =
      before !== null && typeof root.animate === 'function' && !reducedMotion()

    for (const el of root.querySelectorAll<HTMLElement>('[data-flip-key]')) {
      const key = el.dataset.flipKey ?? ''
      const spot = { x: el.offsetLeft, y: el.offsetTop }
      after.set(key, spot)
      if (!animate) continue

      const was = before.get(key)
      if (!was) {
        el.animate(
          [
            { opacity: 0, transform: 'scale(0.9)' },
            { opacity: 1, transform: 'none' },
          ],
          ENTER,
        )
        continue
      }
      if (was.x === spot.x && was.y === spot.y) continue
      // An element caught mid-slide starts from where it is on screen, not where it was headed.
      const seen = el.getBoundingClientRect()
      const driftX = seen.left - box.left - root.clientLeft - spot.x
      const driftY = seen.top - box.top - root.clientTop - spot.y
      const dx = was.x - spot.x + driftX
      const dy = was.y - spot.y + driftY
      for (const running of el.getAnimations()) running.cancel()
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        MOVE,
      )
    }
    spots.current = after
  })

  return ref
}
