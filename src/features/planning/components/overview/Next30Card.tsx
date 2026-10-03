import { useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { addDaysISO } from '#/features/planned/data/dates'
import type { UpcomingRow } from '#/features/planning/data/upcoming'
import { dayMonth } from '#/features/planning/view/format'
import { useElementWidth } from '#/features/planning/hooks/useElementWidth'
import { NEXT_DAYS, placeLabels } from '#/features/planning/view/overview'
import type { DayEvent } from '#/features/planning/view/overview'
import { cn } from '#/lib/utils'
import {
  CardHeader,
  PlanCard,
} from '#/features/planning/components/kit/PlanCard'

/** The least room (px) between two labels on the same side of the axis. */
const LABEL_GAP_PX = 104
/** Used until the axis is measured. */
const FALLBACK_WIDTH = 700
const TICKS = [0, 7, 14, 21, 28]

type Props = {
  events: ReadonlyArray<DayEvent>
  due: ReadonlyArray<UpcomingRow>
  today: string
  onSeeAll: () => void
  onEvent: (event: DayEvent) => void
}

/** Next 30 days (04 §5): bills and paydays on a 30-day axis, and what waits to be confirmed. */
export function Next30Card({ events, due, today, onSeeAll, onEvent }: Props) {
  return (
    <PlanCard>
      <CardHeader
        title="Next 30 days"
        end={
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[12.5px] font-bold text-fp-accent-ink hover:underline"
          >
            See all <span className="inline-block rtl:-scale-x-100">→</span>
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-[18px] pb-4">
        {due.length > 0 ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex items-center gap-2 rounded-[11px] border border-fp-warn-line bg-fp-warn-soft px-3 py-[9px] text-start text-[13px]"
          >
            <span
              aria-hidden
              className="size-[7px] flex-none rounded-full bg-fp-warn-fill"
            />
            <span className="flex-none font-extrabold text-fp-warn">
              {due.length} to confirm
            </span>
            <span className="min-w-0 flex-1 truncate text-fp-text-2">
              {due
                .map((r) => `${r.name} · ${dayMonth(r.item.date)}`)
                .join(', ')}
            </span>
            <ChevronRight
              size={15}
              aria-hidden
              className="flex-none text-fp-warn rtl:-scale-x-100"
            />
          </button>
        ) : null}
        {events.length === 0 ? (
          <p className="text-[13px] text-fp-text-3">
            No bills or paydays in the next 30 days.
          </p>
        ) : (
          <>
            <Timeline events={events} today={today} onEvent={onEvent} />
            <MobileList events={events} onEvent={onEvent} />
          </>
        )}
      </div>
    </PlanCard>
  )
}

const pctOf = (day: number) =>
  (Math.min(NEXT_DAYS, Math.max(0, day)) / NEXT_DAYS) * 100

/** Desktop: dots on an axis, labels alternating above and below on stems. */
function Timeline({
  events,
  today,
  onEvent,
}: {
  events: ReadonlyArray<DayEvent>
  today: string
  onEvent: (e: DayEvent) => void
}) {
  const axis = useRef<HTMLDivElement>(null)
  const width = useElementWidth(axis, FALLBACK_WIDTH)
  const sides = placeLabels(
    events.map((e) => (pctOf(e.day) / 100) * width),
    LABEL_GAP_PX,
  )
  const placed = events.map((e, i) => ({ e, at: pctOf(e.day), ...sides[i] }))
  return (
    <div ref={axis} className="relative mx-11 hidden h-[152px] md:block">
      <div className="absolute inset-x-0 top-[61px] h-[2px] rounded-full bg-fp-border-strong" />
      {placed.map(({ e, side, at, labelled }) => (
        <button
          key={e.key}
          type="button"
          onClick={() => onEvent(e)}
          aria-label={`${e.name} · ${dayMonth(e.date)} · ${e.amount}`}
          className="group absolute top-[56px] -translate-x-1/2 rtl:translate-x-1/2"
          style={{ insetInlineStart: `${at}%` }}
        >
          <span
            className={cn(
              'block size-3 rounded-full ring-2 ring-fp-surface',
              e.kind === 'payday' &&
                'outline-2 outline-offset-1 outline-fp-accent',
            )}
            style={{ background: e.color }}
          />
          {labelled ? (
            <span
              className={cn(
                'absolute start-1/2 flex w-max -translate-x-1/2 flex-col items-center text-center rtl:translate-x-1/2',
                side === 'above' ? 'bottom-[18px]' : 'top-[18px]',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute h-[10px] w-px bg-fp-border-strong',
                  side === 'above' ? '-bottom-[10px]' : '-top-[10px]',
                )}
              />
              <span className="text-[10.5px] text-fp-text-3">
                {dayMonth(e.date)}
              </span>
              <span className="max-w-[110px] truncate text-[12px] font-bold group-hover:underline">
                {e.name}
              </span>
              <span
                className={cn(
                  'fp-sensitive text-[11.5px]',
                  e.kind === 'payday' ? 'text-fp-accent-ink' : 'text-fp-text-2',
                )}
              >
                {e.amount}
              </span>
            </span>
          ) : null}
        </button>
      ))}
      <div className="absolute inset-x-0 bottom-0 h-4">
        {TICKS.map((day) => (
          <span
            key={day}
            className={cn(
              'absolute -translate-x-1/2 text-[10.5px] font-bold whitespace-nowrap rtl:translate-x-1/2',
              day === 0 ? 'text-fp-accent-ink' : 'text-fp-text-3',
            )}
            style={{ insetInlineStart: `${pctOf(day)}%` }}
          >
            {day === 0 ? 'Today' : dayMonth(addDaysISO(today, day))}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Mobile: a strip of dots, then the list. */
function MobileList({
  events,
  onEvent,
}: {
  events: ReadonlyArray<DayEvent>
  onEvent: (e: DayEvent) => void
}) {
  return (
    <div className="flex flex-col gap-2 md:hidden">
      <div className="relative mx-2 h-[26px]">
        <div className="absolute inset-x-0 top-[12px] h-[2px] rounded-full bg-fp-border-strong" />
        {events.map((e) => (
          <span
            key={e.key}
            aria-hidden
            className="absolute top-[8px] size-[10px] -translate-x-1/2 rounded-full ring-2 ring-fp-surface rtl:translate-x-1/2"
            style={{
              insetInlineStart: `${pctOf(e.day)}%`,
              background: e.color,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col">
        {events.map((e) => (
          <li key={e.key}>
            <button
              type="button"
              onClick={() => onEvent(e)}
              className="flex w-full items-center gap-[10px] py-[7px] text-start text-[13px]"
            >
              <span className="w-[44px] flex-none text-[12px] font-bold text-fp-text-3">
                {dayMonth(e.date)}
              </span>
              <span
                aria-hidden
                className="size-2 flex-none rounded-full"
                style={{ background: e.color }}
              />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {e.name}
              </span>
              <span
                className={cn(
                  'fp-sensitive font-bold tabular-nums',
                  e.kind === 'payday' && 'text-fp-accent-ink',
                )}
              >
                {e.amount}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
