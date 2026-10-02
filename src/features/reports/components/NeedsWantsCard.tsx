import { useState } from 'react'
import { Scale } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { SegmentedBar } from '#/components/SegmentedBar'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Skeleton } from '#/components/ui/skeleton'
import type { SpendBucket } from '#/features/reports/data/needsWants'
import type {
  NeedsWantsView,
  NwsRow,
  Tick,
} from '#/features/reports/data/needsWantsCard'
import { SkeletonRows } from '#/features/transactions/components/SkeletonRows'
import { cn } from '#/lib/utils'
import { NeedsWantsRow } from './NeedsWantsRow'
import { NeedsWantsTrend } from './NeedsWantsTrend'
import { SEGMENT_FILL } from './needsWantsFills'
import { CARD_TITLE, REPORT_CARD } from './styles'

type Props = {
  /** Null while the period's rows load. */
  view: NeedsWantsView | null
  onViewCategory: (bucket: SpendBucket, rootId: string) => void
  onSort: (rootIds: string[]) => void
}

const VERDICT_TONE = {
  good: 'text-fp-accent-ink',
  warn: 'text-fp-warn',
}

/** Income split into needs, wants and savings, beside the 50/30/20 guideline. */
export function NeedsWantsCard({ view, onViewCategory, onSort }: Props) {
  const [open, setOpen] = useState<SpendBucket | null>(null)
  const toggle = (b: SpendBucket) => setOpen((cur) => (cur === b ? null : b))

  return (
    <section
      aria-label="Needs, wants, savings"
      className={`${REPORT_CARD} flex flex-col gap-4 px-[14px] pt-[18px] pb-3 md:px-5`}
    >
      <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-1 px-[6px] md:px-0">
        <span className={CARD_TITLE}>Needs, wants, savings</span>
        <span className="flex-1" />
        <span className="fp-sensitive text-[13px] font-semibold text-fp-text-2">
          <ValueOrSkeleton value={view?.caption} className="h-3.5 w-32" />
        </span>
      </div>

      {view === null ? (
        <>
          <Skeleton aria-hidden className="h-[14px] rounded-[8px]" />
          <SkeletonRows count={3} rowClassName="px-2 py-[9px]" />
        </>
      ) : view.empty ? (
        <EmptyState
          icon={Scale}
          size="sm"
          title="Nothing came in or went out"
          text="Once income and spending land in this period, you'll see how they split."
        />
      ) : (
        <>
          <GuidelineBar view={view} />
          <div className="-mx-2 flex flex-col md:mx-0">
            {view.rows.map((row) => (
              <NeedsWantsRow
                key={row.key}
                label={row.label}
                fill={SEGMENT_FILL[row.key]}
                amountStr={row.amountStr}
                pctStr={row.pctStr}
                detail={<RowDetail row={row} />}
                categories={row.categories}
                expanded={open === row.key}
                onToggle={() => toggle(row.key)}
                onViewCategory={(rootId) => onViewCategory(row.key, rootId)}
              />
            ))}
            {view.unsorted ? (
              <NeedsWantsRow
                label="Not sorted"
                fill={SEGMENT_FILL.unsorted}
                amountStr={view.unsorted.amountStr}
                pctStr={view.unsorted.pctStr}
                detail="Not counted as a need or a want yet"
                action={
                  <button
                    type="button"
                    onClick={() => onSort(view.unsorted?.rootIds ?? [])}
                    className="flex-none rounded-[9px] border border-fp-border bg-fp-surface px-[9px] py-[5px] text-[12px] font-bold text-fp-text hover:bg-fp-bg focus-visible:ring-[3px] focus-visible:ring-fp-accent/30 focus-visible:outline-none"
                  >
                    {view.unsorted.actionLabel}
                  </button>
                }
                categories={view.unsorted.categories}
                expanded={open === 'unsorted'}
                onToggle={() => toggle('unsorted')}
                onViewCategory={(rootId) => onViewCategory('unsorted', rootId)}
              />
            ) : null}
          </div>
          {view.months ? <NeedsWantsTrend months={view.months} /> : null}
        </>
      )}
    </section>
  )
}

function GuidelineBar({ view }: { view: NeedsWantsView }) {
  return (
    <div className="flex flex-col gap-1">
      <SegmentedBar
        segments={view.segments.map((s) => ({
          key: s.key,
          label: s.label,
          fillClassName: SEGMENT_FILL[s.key],
          pct: s.widthPct,
          valueStr: s.valueStr,
          pctStr: s.pctStr,
        }))}
      />
      {view.ticks.length > 0 ? (
        <div aria-hidden className="relative h-[16px]">
          {view.ticks.map((t: Tick) => (
            <span
              key={t.label}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center rtl:translate-x-1/2"
              style={{ insetInlineStart: `${t.atPct}%` }}
            >
              <span className="h-[5px] w-px bg-fp-text-3" />
              <span className="text-[10.5px] leading-none font-bold text-fp-text-3 tabular-nums">
                {t.label}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] font-semibold text-fp-text-3">
          The split is measured against income, and none came in this period.
        </p>
      )}
    </div>
  )
}

function RowDetail({ row }: { row: NwsRow }) {
  return (
    <span className="flex flex-wrap items-center gap-x-[6px] gap-y-[2px]">
      <span>guideline {row.guideline}</span>
      {row.verdict ? (
        <span
          aria-label={row.verdict.label}
          className={cn('font-bold', VERDICT_TONE[row.verdict.tone])}
        >
          {row.verdict.text}
        </span>
      ) : null}
      {row.wasStr ? <span>· {row.wasStr}</span> : null}
      {row.note ? <span className="fp-sensitive">· {row.note}</span> : null}
    </span>
  )
}
