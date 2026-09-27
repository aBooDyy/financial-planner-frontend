import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { RailCardHeader } from '#/components/RailCardHeader'
import { Skeleton } from '#/components/ui/skeleton'
import type { ForecastView } from '#/features/planned/data/forecast'
import { OUTLOOK_DAYS } from '#/features/planned/data/outlook'
import { ForecastChart } from './ForecastChart'
import { ForecastReadout } from './ForecastReadout'
import { ForecastStatusLine } from './ForecastStatusLine'

type Props = {
  /** `null` while the balances or the planned rows load. */
  view: ForecastView | null
}

/** The Planned tab's rail: every account's balance, day by day, as plans land. */
export function ForecastCard({ view }: Props) {
  const [picked, setPicked] = useState<number | null>(null)

  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <RailCardHeader
        title="Balance ahead"
        sub={`All accounts, next ${OUTLOOK_DAYS} days`}
      />
      {view === null ? (
        <div aria-hidden className="flex flex-col gap-[10px]">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-[96px] rounded-[10px]" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : view.isFlat ? (
        <EmptyState
          icon={CalendarCheck}
          size="sm"
          title="No bills or paydays soon"
          text={`Your balance stays at ${view.days[0].balanceStr} for the next ${OUTLOOK_DAYS} days.`}
        />
      ) : (
        <ForecastBody view={view} picked={picked} onPick={setPicked} />
      )}
    </div>
  )
}

function ForecastBody({
  view,
  picked,
  onPick,
}: {
  view: ForecastView
  picked: number | null
  onPick: (index: number | null) => void
}) {
  const shownIndex = picked ?? view.lowIndex
  const first = view.days[0]
  const last = view.days[view.days.length - 1]

  return (
    <>
      <ForecastReadout day={view.days[shownIndex]} isLowest={picked === null} />
      <ForecastChart
        view={view}
        shownIndex={shownIndex}
        pickedIndex={picked}
        onPick={onPick}
      />
      <div className="mt-[6px] mb-3 flex justify-between text-[11px] font-medium text-fp-text-3">
        <span>{first.dateStr}</span>
        <span>{last.dateStr}</span>
      </div>
      <ForecastStatusLine status={view.status} />
    </>
  )
}
