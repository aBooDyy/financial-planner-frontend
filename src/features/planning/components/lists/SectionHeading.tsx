import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'

type Props = {
  title: string
  count?: number
  sub?: string
  /** A quiet link after the summary, e.g. "Planning settings". */
  subLink?: ReactNode
  /** "+ Add bill" — skips the chooser. */
  addLabel: string
  onAdd: () => void
  /** The summary line waits as a skeleton. */
  loading?: boolean
}

/** A list section's head: "Bills 8", its one-line summary and its add button. */
export function SectionHeading({
  title,
  count,
  sub,
  subLink,
  addLabel,
  onAdd,
  loading,
}: Props) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-baseline gap-2 text-[20px] font-extrabold tracking-[-0.01em] text-fp-text">
          {title}
          {count !== undefined && count > 0 ? (
            <span className="text-[14px] font-bold text-fp-text-3 tabular-nums">
              {count}
            </span>
          ) : null}
        </h2>
        {loading ? (
          <p aria-hidden className="mt-[2px] flex h-[19px] items-center">
            <Skeleton className="h-3 w-64 max-w-full" />
          </p>
        ) : sub ? (
          <p className="mt-[2px] text-[12.5px] text-fp-text-3">
            <span className="fp-sensitive">{sub}</span>
            {subLink ? <> · {subLink}</> : null}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="quiet"
        onClick={onAdd}
        className="rounded-[11px] px-[13px] py-[8px] text-[13px] font-bold text-fp-text"
      >
        <Plus size={15} strokeWidth={2.4} />
        {addLabel}
      </Button>
    </div>
  )
}
