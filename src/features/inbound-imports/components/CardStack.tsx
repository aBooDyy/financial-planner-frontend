import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  position: number
  count: number
  onPrev: () => void
  onNext: () => void
  children: ReactNode
}

const NAV =
  'flex size-8 items-center justify-center rounded-[10px] border-[1.5px] border-fp-border bg-fp-surface text-fp-text-2 transition hover:border-fp-border-strong hover:text-fp-text disabled:opacity-40'

/** The current import on top of a stack whose depth says how many wait behind it. */
export function CardStack({
  position,
  count,
  onPrev,
  onNext,
  children,
}: Props) {
  const single = count < 2
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-[10px]">
        <span
          aria-live="polite"
          className="flex-1 text-[12.5px] font-bold text-fp-text-2"
        >
          {position + 1} of {count}
        </span>
        <button
          type="button"
          aria-label="Previous import"
          onClick={onPrev}
          disabled={single}
          className={NAV}
        >
          <ChevronLeft
            size={15}
            strokeWidth={2.2}
            className="rtl:-scale-x-100"
          />
        </button>
        <button
          type="button"
          aria-label="Next import"
          onClick={onNext}
          disabled={single}
          className={NAV}
        >
          <ChevronRight
            size={15}
            strokeWidth={2.2}
            className="rtl:-scale-x-100"
          />
        </button>
      </div>
      <div className="relative pb-5">
        {count > 2 ? (
          <div
            aria-hidden
            className="absolute inset-x-6 top-6 bottom-0 rounded-[18px] border-[1.5px] border-fp-border bg-fp-surface-2"
          />
        ) : null}
        {count > 1 ? (
          <div
            aria-hidden
            className="absolute inset-x-3 top-3 bottom-[10px] rounded-[18px] border-[1.5px] border-fp-border bg-fp-surface shadow-[0_4px_10px_-6px_rgba(20,18,12,0.15)]"
          />
        ) : null}
        <div className="relative rounded-[18px] border-[1.5px] border-fp-border bg-fp-surface p-4 shadow-[0_10px_24px_-14px_rgba(20,18,12,0.28)]">
          {children}
        </div>
      </div>
    </div>
  )
}
