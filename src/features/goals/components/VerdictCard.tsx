import { Check, CircleAlert, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { STATUS_COLORS } from '#/features/goals/constants'
import type { FundingStatus } from '#/features/goals/constants'
import type { GoalsView } from '#/features/goals/data/selectors'

const ICON: Record<FundingStatus, LucideIcon> = {
  green: Check,
  amber: Clock,
  red: CircleAlert,
}

type Props = { view: GoalsView }

export function VerdictCard({ view }: Props) {
  const { verdict } = view
  const c = STATUS_COLORS[verdict.status]
  const Icon = ICON[verdict.status]
  const isGood = verdict.status === 'green'

  return (
    <div
      className="rounded-[18px] p-[18px] shadow-fp"
      style={{
        border: `1px solid ${isGood ? 'var(--fp-border)' : c.main}`,
        background: isGood ? 'var(--fp-surface)' : c.soft,
      }}
    >
      <div className="mb-[14px] flex items-center gap-[11px]">
        <div
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]"
          style={{ background: c.soft, color: c.main }}
        >
          <Icon size={20} strokeWidth={2} />
        </div>
        <div>
          <div className="text-[16px] font-extrabold tracking-[-0.01em]">
            {verdict.title}
          </div>
          <div className="mt-px text-[12.5px] text-fp-text-2">
            {verdict.sub}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <MiniStat label="Income" valueStr={view.incomeStr} />
        <MiniStat label="Set aside" valueStr={view.setAsideStr} />
      </div>

      {verdict.suggestions.length > 0 ? (
        <div className="mt-[14px]">
          <div className="mb-[9px] text-[11.5px] font-bold tracking-[0.04em] text-fp-text-2 uppercase">
            {verdict.suggestTitle}
          </div>
          <div className="flex flex-col gap-[9px]">
            {verdict.suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-[9px]">
                <span
                  className="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full"
                  style={{ background: STATUS_COLORS[s.status].main }}
                />
                <span className="text-[12.5px] leading-[1.45] text-fp-text-2">
                  {s.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MiniStat({ label, valueStr }: { label: string; valueStr: string }) {
  return (
    <div className="flex-1 rounded-[12px] border border-fp-border bg-fp-surface px-[11px] py-[10px]">
      <div className="text-[10.5px] font-bold tracking-[0.04em] text-fp-text-3 uppercase">
        {label}
      </div>
      <div className="mt-[3px] text-[15px] font-extrabold tabular-nums">
        {valueStr}
      </div>
    </div>
  )
}
