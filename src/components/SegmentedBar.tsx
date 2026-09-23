import { useEffect, useRef, useState } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { cn } from '#/lib/utils'

export type BarSegment = {
  key: string
  label: string
  color: string
  pct: number
  valueStr: string
  pctStr: string
  note?: string
}

type Props = {
  segments: BarSegment[]
  className?: string
  minWidth?: string
}

/** A stacked proportional bar whose parts reveal their figures on hover, focus or tap. */
export function SegmentedBar({ segments, className, minWidth = '2px' }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // A tap has no pointer to move away, so the only way back out is a press elsewhere.
  useEffect(() => {
    if (active === null) return
    const close = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [active])

  return (
    <div
      ref={barRef}
      className={cn(
        'flex h-[14px] gap-[2px] overflow-hidden rounded-[8px] bg-fp-surface-2',
        className,
      )}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setActive(null)
      }}
    >
      {segments.map((s) => (
        // `open` is controlled and `onOpenChange` deliberately unhandled: Radix's own
        // hover/dismiss logic becomes inert and every input path runs through `active`.
        <Tooltip key={s.key} open={active === s.key}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${s.label}: ${s.valueStr}, ${s.pctStr}`}
              className="h-full cursor-pointer transition-opacity outline-none"
              style={{
                width: `${s.pct}%`,
                minWidth,
                background: s.color,
                opacity: active !== null && active !== s.key ? 0.4 : 1,
              }}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') setActive(s.key)
              }}
              onClick={() => setActive((cur) => (cur === s.key ? null : s.key))}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setActive(null)
              }}
            />
          </TooltipTrigger>
          <TooltipContent sideOffset={6} className="px-[10px] py-[7px]">
            <div className="flex items-center gap-[7px]">
              <span
                className="h-[8px] w-[8px] shrink-0 rounded-[2px]"
                style={{ background: s.color }}
              />
              <span className="text-[12px] font-semibold">{s.label}</span>
            </div>
            <div className="mt-[3px] flex items-baseline gap-[6px]">
              <span className="text-[13px] font-bold tabular-nums">
                {s.valueStr}
              </span>
              <span className="text-[11px] tabular-nums opacity-70">
                {s.pctStr}
              </span>
            </div>
            {s.note ? (
              <div className="mt-[2px] text-[11px] opacity-70">{s.note}</div>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
