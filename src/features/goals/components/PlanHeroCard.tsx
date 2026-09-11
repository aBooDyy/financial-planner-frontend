import { STATUS_COLORS } from '#/features/goals/constants'
import type { GoalsView } from '#/features/goals/data/selectors'

type Props = { view: GoalsView }

export function PlanHeroCard({ view }: Props) {
  const v = STATUS_COLORS[view.verdict.status]

  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-5 shadow-fp md:px-[26px] md:py-6">
      <div className="mb-4 flex items-center gap-[9px]">
        <span className="text-[12px] font-bold tracking-[0.05em] text-fp-text-2 uppercase">
          Monthly plan
        </span>
        <span className="text-[11.5px] text-fp-text-3">· {view.asOfStr}</span>
        <div className="flex-1" />
        <span
          className="inline-flex items-center gap-[6px] rounded-full px-[11px] py-[5px] text-[12px] font-bold"
          style={{ color: v.main, background: v.soft }}
        >
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: v.main }}
          />
          {view.verdict.title}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-[14px]">
        <Figure label="Income" valueStr={view.incomeStr} />
        <Operator symbol="−" />
        <Figure label="Set aside" valueStr={view.setAsideStr} />
        <Operator symbol="=" />
        <div>
          <div className="mb-[3px] text-[11.5px] font-semibold text-fp-text-3">
            {view.leftoverLabel}
          </div>
          <div
            className="text-[26px] leading-none font-extrabold tracking-[-0.02em] tabular-nums whitespace-nowrap"
            style={{
              color: view.leftoverIsOver ? '#E5484D' : 'var(--fp-accent)',
            }}
          >
            {view.leftoverStr}
            <span className="text-[13px] font-semibold opacity-60">/mo</span>
          </div>
        </div>
      </div>

      <div className="mt-[18px] flex h-[14px] gap-[2px] overflow-hidden rounded-[8px] bg-fp-surface-2">
        {view.cashSegments.map((seg) => (
          <div
            key={seg.id}
            style={{
              width: `${Math.max(2, seg.pct)}%`,
              ...segmentStyle(seg.color),
            }}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fp-text-2">
        <span className="flex items-center gap-[6px]">
          <span className="h-[9px] w-[9px] rounded-[3px] bg-fp-accent" />
          {view.goalsFundedStr}
        </span>
        <span className="text-fp-border-strong">·</span>
        <span className="flex items-center gap-[6px]">
          <span
            className="h-[9px] w-[9px] rounded-[3px]"
            style={{
              background:
                view.atRiskCount > 0
                  ? STATUS_COLORS.amber.main
                  : 'var(--fp-border-strong)',
            }}
          />
          {view.goalsAtRiskStr}
        </span>
        <span className="text-fp-border-strong">·</span>
        <span>{view.horizonStr}</span>
      </div>
    </div>
  )
}

function Figure({ label, valueStr }: { label: string; valueStr: string }) {
  return (
    <div>
      <div className="mb-[3px] text-[11.5px] font-semibold text-fp-text-3">
        {label}
      </div>
      <div className="text-[26px] leading-none font-extrabold tracking-[-0.02em] tabular-nums whitespace-nowrap">
        {valueStr}
        <span className="text-[13px] font-semibold text-fp-text-3">/mo</span>
      </div>
    </div>
  )
}

function Operator({ symbol }: { symbol: string }) {
  return (
    <div className="pb-[2px] text-[22px] font-semibold text-fp-text-3">
      {symbol}
    </div>
  )
}

function segmentStyle(color: string): React.CSSProperties {
  if (color === 'slack') {
    return {
      background: 'var(--fp-surface-2)',
      boxShadow: 'inset 0 0 0 1px var(--fp-border)',
    }
  }
  if (color === 'over') {
    return {
      background:
        'repeating-linear-gradient(45deg,#E5484D,#E5484D 6px,#c93b40 6px,#c93b40 12px)',
    }
  }
  return { background: color }
}
