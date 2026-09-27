import { useEffect, useRef, useState } from 'react'

/**
 * `value` smoothed for display: it turns on only once it has held for `showAfterMs`, and once
 * on it stays on for at least `minOnMs`, so short blips never flash on screen.
 */
export function useCalmFlag(
  value: boolean,
  showAfterMs: number,
  minOnMs: number,
): boolean {
  const [shown, setShown] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (value === shown) return
    const wait = value
      ? showAfterMs
      : Math.max(0, shownAt.current + minOnMs - Date.now())
    const timer = setTimeout(() => {
      if (value) shownAt.current = Date.now()
      setShown(value)
    }, wait)
    return () => clearTimeout(timer)
  }, [value, shown, showAfterMs, minOnMs])

  return shown
}
