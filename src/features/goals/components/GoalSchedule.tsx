import { ChevronDown } from 'lucide-react'
import type { GoalCard } from '#/features/goals/data/selectors'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { cn } from '#/lib/utils'
import { PANE_CARD } from './styles'

/** The goal's month-by-month set-aside path, folded to its one-line summary. */
export function GoalSchedule({ card }: { card: GoalCard }) {
  return (
    <Collapsible className={cn(PANE_CARD, 'group/schedule')}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 text-start">
        <span className="flex-1 text-[14px] font-extrabold text-fp-text">
          Monthly plan
        </span>
        <span className="min-w-0 truncate text-[13px] font-bold text-fp-text-2 tabular-nums">
          {card.scheduleSummary}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          className="shrink-0 text-fp-text-3 transition-transform group-data-[state=open]/schedule:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-[10px]">
        <div
          className={cn(
            '-mt-1 text-[12.5px] font-bold',
            card.status === 'red' ? 'text-fp-danger' : 'text-fp-accent-ink',
          )}
        >
          {card.coverageStr}
        </div>
        <div className="max-h-[230px] overflow-auto">
          {card.scheduleMonths.map((mo, i) => (
            <div
              key={i}
              className="flex justify-between gap-3 border-t border-fp-border py-[5px] text-[12.5px]"
            >
              <span
                className={cn(
                  'font-semibold',
                  mo.muted ? 'text-fp-text-3' : 'text-fp-text',
                )}
              >
                {mo.label}
              </span>
              <span
                className={cn(
                  'font-bold whitespace-nowrap tabular-nums',
                  mo.covered
                    ? 'text-fp-accent-ink'
                    : mo.muted
                      ? 'text-fp-text-3'
                      : 'text-fp-text',
                )}
              >
                {mo.amountStr}
                {mo.covered ? ' · covered' : ''}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
