import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/** The element's rendered width, kept current as it resizes; `fallback` until measured. */
export function useElementWidth(
  ref: RefObject<HTMLElement | null>,
  fallback: number,
): number {
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}
