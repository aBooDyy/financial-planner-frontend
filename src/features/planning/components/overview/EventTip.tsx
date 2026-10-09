import type { ReactElement } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { weekdayDayMonth } from '#/features/planning/view/format'
import { daysAhead } from '#/features/planning/view/overview'
import type { DayEvent } from '#/features/planning/view/overview'

/** The timeline's hover card: the day, then each event's amount, repeat, wallet and cover. */
export function EventTip({
  events,
  side,
  children,
}: {
  /** All on the same day. */
  events: ReadonlyArray<DayEvent>
  side: 'top' | 'bottom' | 'right'
  children: ReactElement
}) {
  const first = events.at(0)
  if (!first) return children
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        className="flex w-[240px] flex-col gap-2 px-3 py-[9px]"
      >
        <span className="text-[11px] font-semibold opacity-70">
          {weekdayDayMonth(first.date)} · {daysAhead(first.day)}
        </span>
        {events.map((e) => (
          <span key={e.key} className="flex flex-col gap-px">
            <span className="flex items-center gap-[7px]">
              <span
                aria-hidden
                className="size-2 flex-none rounded-full"
                style={{ background: e.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">
                {e.name}
              </span>
              <span className="fp-sensitive flex-none text-[12.5px] font-bold tabular-nums">
                {e.amount}
              </span>
            </span>
            <span className="truncate ps-[15px] text-[11px] opacity-70">
              {eventFacts(e).join(' · ')}
            </span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

function eventFacts(e: DayEvent): string[] {
  return [
    e.sub,
    e.walletName,
    e.autopay ? 'Auto-pay' : null,
    e.cover?.label ?? null,
  ].filter((f): f is string => f !== null)
}
