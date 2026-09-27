import { Link } from '@tanstack/react-router'
import { CalendarCheck } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { RailCardHeader } from '#/components/RailCardHeader'
import { SegmentedBar } from '#/components/SegmentedBar'
import { Skeleton } from '#/components/ui/skeleton'
import type { HeadedView } from '#/features/planned/data/headed'
import { OUTLOOK_DAYS } from '#/features/planned/data/outlook'
import { HeadedLegend } from './HeadedLegend'
import { HeadedLeftover } from './HeadedLeftover'

type Props = {
  /** `null` while the planned rows load. */
  view: HeadedView | null
}

/** The Planned tab's rail: planned income against what the plans already claim. */
export function HeadedCard({ view }: Props) {
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <RailCardHeader
        title="Where it's headed"
        sub={`Planned income, next ${OUTLOOK_DAYS} days`}
        action={
          <Link
            to="/goals"
            className="shrink-0 text-[12px] font-semibold text-fp-accent-ink hover:underline"
          >
            Goals
          </Link>
        }
      />
      {view === null ? (
        <div aria-hidden className="flex flex-col gap-[10px]">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-[14px] rounded-[8px]" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ) : view.isEmpty ? (
        <EmptyState
          icon={CalendarCheck}
          size="sm"
          title="Nothing planned this month"
          text="Income, bills and set-asides due soon are split here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12.5px] font-semibold text-fp-text-2">
              Coming in
            </span>
            <span className="fp-sensitive text-[17px] font-extrabold tabular-nums">
              {view.inStr}
            </span>
          </div>
          <SegmentedBar segments={view.segments} />
          <HeadedLegend lines={view.lines} />
          <HeadedLeftover leftover={view.leftover} />
        </div>
      )}
    </div>
  )
}
