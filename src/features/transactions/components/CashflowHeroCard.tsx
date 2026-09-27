import type { ReactNode } from 'react'
import { SegmentedBar } from '#/components/SegmentedBar'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Skeleton } from '#/components/ui/skeleton'
import { RED } from '#/features/transactions/constants'
import type { CashflowView } from '#/features/transactions/data/selectors'

type Stat = {
  op?: string
  label: string
  value: string | undefined
  accent?: 'pos' | 'neg'
}

type Props = {
  /** `null` while the period's rows load; the labels and frame render regardless. */
  view: CashflowView | null
  periodLabel: string
  /** Heads the card above the period figures, e.g. the chosen accounts' balance. */
  header?: ReactNode
}

export function CashflowHeroCard({ view, periodLabel, header }: Props) {
  const stats: Stat[] = [
    { label: 'Income', value: view?.incomeStr },
    { op: '−', label: 'Spent', value: view?.spentStr },
  ]
  if (view?.hasSaved)
    stats.push({ op: '−', label: 'Saved', value: view.savedStr })
  stats.push({
    op: '=',
    label: 'Net',
    value: view?.netStr,
    accent: view ? (view.netPositive ? 'pos' : 'neg') : undefined,
  })

  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[20px_18px] shadow-fp md:p-[24px_26px]">
      {header}
      <div className="mb-4 flex items-center gap-[9px]">
        <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-fp-text-2">
          Cashflow
        </span>
        <span className="text-[11.5px] text-fp-text-3">· {periodLabel}</span>
        <div className="flex-1" />
        <ValueOrSkeleton
          value={view ? <NetPill view={view} /> : null}
          className="h-[26px] w-[104px] rounded-full"
        />
      </div>

      <div className="flex flex-wrap items-end gap-[14px]">
        {stats.map((st, i) => (
          <div key={i} className="flex items-end gap-[14px]">
            {st.op ? (
              <div className="pb-[2px] text-[22px] font-semibold text-fp-text-3">
                {st.op}
              </div>
            ) : null}
            <div>
              <div className="mb-[3px] text-[11.5px] font-semibold text-fp-text-3">
                {st.label}
              </div>
              <div
                className="fp-sensitive text-[26px] font-extrabold leading-none tracking-[-0.02em] tabular-nums"
                style={
                  st.accent
                    ? { color: st.accent === 'pos' ? 'var(--fp-accent)' : RED }
                    : undefined
                }
              >
                <ValueOrSkeleton value={st.value} className="h-[26px] w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {view ? (
        <SegmentedBar segments={view.segments} className="mt-[18px]" />
      ) : (
        <Skeleton aria-hidden className="mt-[18px] h-[14px] rounded-[8px]" />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fp-text-2">
        <ValueOrSkeleton value={view?.txCountStr} className="h-3.5 w-24" />
        <ValueOrSkeleton
          value={
            view ? (
              <span className="flex items-center gap-[6px]">
                <span
                  className="h-[9px] w-[9px] rounded-[3px]"
                  style={{ background: view.topColor }}
                />
                {view.topLabel}
              </span>
            ) : null
          }
          className="h-3.5 w-36"
        />
      </div>
    </div>
  )
}

/** "Net positive" / "Net negative", tinted by the sign. */
function NetPill({ view }: { view: CashflowView }) {
  const color = view.netPositive ? 'var(--fp-accent)' : RED
  const background = view.netPositive
    ? 'var(--fp-accent-soft)'
    : 'rgba(229,72,77,0.13)'
  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full px-[11px] py-[5px] text-[12px] font-bold"
      style={{ color, background }}
    >
      <span
        className="h-[7px] w-[7px] rounded-full"
        style={{ background: color }}
      />
      {view.pillLabel}
    </span>
  )
}
