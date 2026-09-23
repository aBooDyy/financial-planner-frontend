import { ChevronRight } from 'lucide-react'
import { STATUS_COLORS } from '#/features/goals/constants'
import type { GoalCard } from '#/features/goals/data/selectors'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'

// The goal's month-by-month set-aside path, collapsed to a one-line teaser.
export function GoalSchedule({ card }: { card: GoalCard }) {
  const color = STATUS_COLORS[card.status].main

  return (
    <Collapsible className="group/schedule border-t border-dashed border-fp-border pt-3">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-[7px] text-[11.5px]">
        <ChevronRight
          size={13}
          strokeWidth={2.4}
          className="shrink-0 text-fp-text-3 transition-transform group-data-[state=open]/schedule:rotate-90"
        />
        <span className="font-bold text-fp-text-2">Monthly plan</span>
        <span className="truncate text-fp-text-3 tabular-nums">
          {card.scheduleSummary}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-[10px]">
        <div className="mb-[9px] text-[11px] font-semibold" style={{ color }}>
          {card.coverageStr}
        </div>
        <div className="relative max-h-[230px] overflow-auto ps-[6px]">
          {card.scheduleMonths.map((mo, i) => (
            <div key={i} className="relative flex pb-[9px] last:pb-0">
              {i < card.scheduleMonths.length - 1 ? (
                <div className="absolute start-[4px] top-[11px] bottom-[-2px] w-[1.5px] bg-fp-border" />
              ) : null}
              <div
                className="absolute start-0 top-[4px] h-[9px] w-[9px] rounded-full ring-[2.5px] ring-fp-surface"
                style={{
                  background:
                    mo.muted && !mo.covered ? 'var(--fp-border-strong)' : color,
                }}
              />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 ps-[19px]">
                <span
                  className={`text-[12px] ${mo.muted ? 'text-fp-text-3' : 'text-fp-text-2'}`}
                >
                  {mo.label}
                  {mo.covered ? ' · covered' : ''}
                </span>
                <span
                  className={`text-[12px] tabular-nums ${mo.muted ? 'text-fp-text-3' : 'font-bold text-fp-text'}`}
                >
                  {mo.amountStr}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
