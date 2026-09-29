import { useState } from 'react'
import { Skeleton } from '#/components/ui/skeleton'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import type { BalanceStrip } from '#/features/reports/data/balances'
import type { TrendView } from '#/features/reports/data/trend'
import { BalanceSummary } from './BalanceSummary'
import { TrendChart } from './TrendChart'
import { TrendReadout } from './TrendReadout'
import { CARD_TITLE, REPORT_CARD } from './styles'

type Props = {
  /** Both null while the period's rows load. */
  trend: TrendView | null
  balance: BalanceStrip | null
  partial: boolean
}

const PLACEHOLDER_BARS = [46, 62, 38, 70, 52, 58]

export function TrendCard({ trend, balance, partial }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = trend?.columns.find((c) => c.key === selectedKey)?.readout

  return (
    <div
      className={`${REPORT_CARD} flex flex-col gap-[14px] px-4 pt-[18px] pb-4 md:px-5`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-[2px]">
          <span className={CARD_TITLE}>Income &amp; spending</span>
          <span className="text-[12.5px] text-fp-text-3">
            <ValueOrSkeleton value={trend?.sub} className="h-3 w-20" />
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-3">
          <LegendItem swatch="bg-fp-chart-in" label="Income" />
          <LegendItem swatch="bg-fp-chart-out" label="Spending" />
        </div>
      </div>

      <BalanceSummary strip={balance} />
      <TrendReadout
        readout={selected ?? trend?.whole ?? null}
        fallbackTitle={partial ? 'So far' : 'Whole period'}
      />

      {trend ? (
        <TrendChart
          columns={trend.columns}
          grid={trend.grid}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
        />
      ) : (
        <div aria-hidden className="flex h-[220px] items-end gap-3 ps-10 pb-5">
          {PLACEHOLDER_BARS.map((h, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-[6px]"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-fp-text-2">
      <span aria-hidden className={`size-[9px] rounded-[3px] ${swatch}`} />
      {label}
    </span>
  )
}
