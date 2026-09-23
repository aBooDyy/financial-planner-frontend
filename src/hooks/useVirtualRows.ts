import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * A fixed-height window over a long list: only what fits on screen (plus a little) is ever
 * rendered, and the rest is two spacers. The import review table can hold tens of thousands
 * of rows, where a DOM node per row costs more than the whole parse did; the currency list
 * is far shorter but puts an input in every row, which is its own kind of expensive.
 *
 * Fixed row heights are a deliberate constraint: they keep the scrollbar honest and the
 * arithmetic exact, which is worth more here than a row that grows to fit its longest note.
 */

export type VirtualWindow = {
  ref: RefObject<HTMLDivElement | null>
  onScroll: () => void
  /** First rendered index, inclusive. */
  first: number
  /** Last rendered index, exclusive. */
  last: number
  padStart: number
  padEnd: number
}

/** Used until the container has been measured — and in tests, which have no layout. */
const ASSUMED_VIEWPORT = 560

type Options = {
  count: number
  rowHeight: number
  overscan?: number
}

export function useVirtualRows({
  count,
  rowHeight,
  overscan = 8,
}: Options): VirtualWindow {
  const ref = useRef<HTMLDivElement>(null)
  const [first, setFirst] = useState(0)
  const [viewport, setViewport] = useState(ASSUMED_VIEWPORT)

  // The window index, not the pixel offset: a scroll inside the row it is already showing
  // changes nothing on screen, and re-rendering for it is what costs the frame.
  const onScroll = useCallback(() => {
    const top = ref.current?.scrollTop ?? 0
    const next = Math.max(0, Math.floor(top / rowHeight) - overscan)
    setFirst((current) => (current === next ? current : next))
  }, [rowHeight, overscan])

  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const measure = () => {
      setViewport((current) => {
        const next = element.clientHeight || ASSUMED_VIEWPORT
        return current === next ? current : next
      })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // A shorter list (a filter change) can leave the window past its end.
  const start = Math.min(first, Math.max(0, count - 1))
  const visible = Math.ceil(viewport / rowHeight) + overscan * 2
  const last = Math.min(count, start + visible)

  return {
    ref,
    onScroll,
    first: start,
    last,
    padStart: start * rowHeight,
    padEnd: Math.max(0, (count - last) * rowHeight),
  }
}
