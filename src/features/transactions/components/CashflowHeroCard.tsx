import { RED } from '#/features/transactions/constants'
import type { CashflowView } from '#/features/transactions/data/selectors'

type Stat = {
  op?: string
  label: string
  value: string
  accent?: 'pos' | 'neg'
}

export function CashflowHeroCard({ view }: { view: CashflowView }) {
  const stats: Stat[] = [
    { label: 'Income', value: view.incomeStr },
    { op: '−', label: 'Spent', value: view.spentStr },
  ]
  if (view.hasSaved)
    stats.push({ op: '−', label: 'Saved', value: view.savedStr })
  stats.push({
    op: '=',
    label: 'Net',
    value: view.netStr,
    accent: view.netPositive ? 'pos' : 'neg',
  })

  const pillColor = view.netPositive ? 'var(--fp-accent)' : RED
  const pillBg = view.netPositive
    ? 'var(--fp-accent-soft)'
    : 'rgba(229,72,77,0.13)'

  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[20px_18px] shadow-fp md:p-[24px_26px]">
      <div className="mb-4 flex items-center gap-[9px]">
        <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-fp-text-2">
          {view.title}
        </span>
        <span className="text-[11.5px] text-fp-text-3">· {view.sub}</span>
        <div className="flex-1" />
        <span
          className="inline-flex items-center gap-[6px] rounded-full px-[11px] py-[5px] text-[12px] font-bold"
          style={{ color: pillColor, background: pillBg }}
        >
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: pillColor }}
          />
          {view.pillLabel}
        </span>
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
                className="text-[26px] font-extrabold leading-none tracking-[-0.02em] tabular-nums"
                style={
                  st.accent
                    ? { color: st.accent === 'pos' ? 'var(--fp-accent)' : RED }
                    : undefined
                }
              >
                {st.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[18px] flex h-[14px] gap-[2px] overflow-hidden rounded-[8px] bg-fp-surface-2">
        {view.segments.map((s, i) => (
          <div
            key={i}
            style={{
              width: `${s.pct}%`,
              minWidth: '2px',
              background: s.color,
            }}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fp-text-2">
        <span>{view.txCountStr}</span>
        <span className="flex items-center gap-[6px]">
          <span
            className="h-[9px] w-[9px] rounded-[3px]"
            style={{ background: view.topColor }}
          />
          {view.topLabel}
        </span>
      </div>
    </div>
  )
}
