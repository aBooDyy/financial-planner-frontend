import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'

/**
 * Pointer dragging for a vertical list whose items carry `data-reorder-item`. The list is
 * reordered live as the pointer crosses an item's midpoint, so what the user sees while
 * dragging is exactly the order that will be kept. Works for mouse, pen and touch alike.
 */
export function useDragReorder(onMove: (from: number, to: number) => void) {
  const listRef = useRef<HTMLOListElement | null>(null)
  const from = useRef<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  const handleProps = (index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      from.current = index
      setDragging(index)
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = from.current
      if (current === null || !listRef.current) return
      const items = listRef.current.querySelectorAll('[data-reorder-item]')
      items.forEach((item, i) => {
        if (i === current) return
        const rect = item.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        const crossed =
          (i > current &&
            event.clientY > mid &&
            event.clientY <= rect.bottom) ||
          (i < current && event.clientY < mid && event.clientY >= rect.top)
        if (crossed && from.current === current) {
          onMove(current, i)
          from.current = i
          setDragging(i)
        }
      })
    },
    onPointerUp: () => {
      from.current = null
      setDragging(null)
    },
    onPointerCancel: () => {
      from.current = null
      setDragging(null)
    },
  })

  return { listRef, dragging, handleProps }
}
