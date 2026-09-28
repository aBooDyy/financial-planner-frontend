import { useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps, KeyboardEvent, TouchEvent } from 'react'
import { Input } from '#/components/ui/input'
import { FIELD_WELL } from '#/components/ui/field-well'
import { cn } from '#/lib/utils'
import { swipeStep } from '#/lib/swipe'
import { useDirectionStore } from '#/stores/direction'

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  /** What would finish `value`, drawn dimmed after it; null offers nothing. */
  completion: string | null
}

const caretAtEnd = (el: HTMLInputElement): boolean =>
  document.activeElement === el &&
  el.selectionStart === el.value.length &&
  el.selectionEnd === el.value.length

/**
 * A text field that offers one inline completion, the way mail apps do: dimmed text after the
 * caret, taken with Tab, the arrow toward the line's end, or a swipe toward it.
 */
export function CompletionInput({
  value,
  onValueChange,
  completion,
  className,
  maxLength,
  onKeyDown,
  ...props
}: Props) {
  const input = useRef<HTMLInputElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const [atEnd, setAtEnd] = useState(false)
  const rtl = useDirectionStore((s) => s.direction === 'rtl')
  const shown = atEnd && completion ? completion : null

  const syncCaret = () => {
    if (input.current) setAtEnd(caretAtEnd(input.current))
  }
  const syncScroll = () => {
    if (ghost.current && input.current)
      ghost.current.scrollLeft = input.current.scrollLeft
  }
  useLayoutEffect(syncScroll)

  const accept = (): boolean => {
    if (!shown) return false
    onValueChange((value + shown).slice(0, maxLength ?? undefined))
    return true
  }

  const keyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const towardEnd = rtl ? 'ArrowLeft' : 'ArrowRight'
    const takes =
      (e.key === 'Tab' && !e.shiftKey) || (e.key === towardEnd && !e.shiftKey)
    if (takes && accept()) e.preventDefault()
    else onKeyDown?.(e)
  }

  const touchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const touchEnd = (e: TouchEvent) => {
    const start = touch.current
    const t = e.changedTouches[0]
    touch.current = null
    if (!start) return
    // -1 is a drag toward the reading end — rightward in LTR.
    if (swipeStep(t.clientX - start.x, t.clientY - start.y, rtl) === -1)
      accept()
  }

  return (
    <div className="relative" onTouchStart={touchStart} onTouchEnd={touchEnd}>
      <Input
        {...props}
        ref={input}
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(e) => onValueChange(e.target.value)}
        onSelect={syncCaret}
        onFocus={syncCaret}
        onBlur={() => setAtEnd(false)}
        onScroll={syncScroll}
        onKeyDown={keyDown}
        className={className}
      />
      {shown ? (
        <div
          ref={ghost}
          aria-hidden
          className={cn(
            FIELD_WELL,
            className,
            'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre border-transparent bg-transparent',
          )}
        >
          <span className="invisible">{value}</span>
          <span className="text-fp-text-3">{shown}</span>
        </div>
      ) : null}
    </div>
  )
}
