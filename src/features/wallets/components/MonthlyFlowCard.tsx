import { useState } from 'react'
import { ChartColumn } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { Skeleton } from '#/components/ui/skeleton'
import { FLOW_MONTHS } from '#/features/wallets/data/monthlyFlow'
import type { MonthlyFlowView } from '#/features/wallets/data/monthlyFlow'
import { MonthlyFlowChart } from './MonthlyFlowChart'
import { MonthlyFlowReadout } from './MonthlyFlowReadout'
import { RailCardHeader } from '#/components/RailCardHeader'

type Props = {
  /** `null` while the window's rows or the rates load. */
  view: MonthlyFlowView | null
}

export function MonthlyFlowCard({ view }: Props) {
  const [picked, setPicked] = useState<string | null>(null)

  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <RailCardHeader
        title="Money in & out"
        sub={`Income vs spending, last ${FLOW_MONTHS} months`}
      />
      {view === null ? (
        <div aria-hidden className="flex flex-col gap-[10px]">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-[110px] rounded-[10px]" />
        </div>
      ) : !view.hasData ? (
        <EmptyState
          icon={ChartColumn}
          size="sm"
          title="No income or spending yet"
          text="Each month's totals appear here as you record them."
        />
      ) : (
        <FlowBody view={view} picked={picked} onPick={setPicked} />
      )}
    </div>
  )
}

type BodyProps = {
  view: MonthlyFlowView
  picked: string | null
  onPick: (key: string | null) => void
}

function FlowBody({ view, picked, onPick }: BodyProps) {
  const month =
    view.months.find((m) => m.key === picked) ??
    view.months[view.months.length - 1]
  return (
    <>
      <MonthlyFlowReadout month={month} />
      <MonthlyFlowChart
        months={view.months}
        scaleStr={view.scaleStr}
        selectedKey={month.key}
        onSelect={onPick}
        onLeave={() => onPick(null)}
      />
    </>
  )
}
